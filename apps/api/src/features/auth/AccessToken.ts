import { Option, Schema } from "effect"

/**
 * Verifies a Cloudflare Access token (the `Cf-Access-Jwt-Assertion` header,
 * ADR-0011): an RS256 JWT signed by one of the team's keys, for this
 * application's AUD tag, issued by the team domain, and not expired.
 * WebCrypto only; no JWT library.
 */

export interface AccessConfig {
  /** The team domain, e.g. `myteam.cloudflareaccess.com`; a leading `https://` is tolerated. */
  readonly teamDomain: string
  /** The Access application's AUD tag. */
  readonly aud: string
}

const Header = Schema.fromJsonString(
  Schema.Struct({ alg: Schema.Literal("RS256"), kid: Schema.String }),
)

const Claims = Schema.fromJsonString(
  Schema.Struct({
    aud: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
    iss: Schema.String,
    exp: Schema.Number,
    nbf: Schema.optional(Schema.Number),
  }),
)

const Jwks = Schema.Struct({
  keys: Schema.Array(
    Schema.Struct({
      kid: Schema.String,
      kty: Schema.Literal("RSA"),
      n: Schema.String,
      e: Schema.String,
    }),
  ),
})

const rs256 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const

/** How long fetched keys are trusted before they are fetched again. */
const keysTtlMs = 10 * 60 * 1000
/** An unknown `kid` refetches (Access rotates keys), but at most this often. */
const refetchCooldownMs = 30 * 1000
/** Tolerated clock difference between Access and the Worker. */
const leewaySeconds = 60

const base64urlDecode = (text: string): Uint8Array<ArrayBuffer> | undefined => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return undefined
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/")
  try {
    return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (c) =>
      c.charCodeAt(0),
    )
  } catch {
    return undefined
  }
}

const decodeSegment = <A>(schema: Schema.Codec<A, string>, segment: string) => {
  const bytes = base64urlDecode(segment)
  if (bytes === undefined) return Option.none<A>()
  return Schema.decodeUnknownOption(schema)(new TextDecoder().decode(bytes))
}

interface KeySet {
  readonly keys: ReadonlyMap<string, CryptoKey>
  readonly fetchedAt: number
}

/**
 * Makes the verifier for one team. Its keys are cached for the life of the
 * verifier (the Worker builds one per isolate), refreshed after `keysTtlMs`,
 * or sooner when a token names a key the cache lacks.
 */
export const makeAccessVerifier = (config: AccessConfig) => {
  const issuer = `https://${config.teamDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
  const certsUrl = `${issuer}/cdn-cgi/access/certs`
  let cached: Promise<KeySet> | undefined

  const fetchKeys = async (): Promise<KeySet> => {
    const response = await fetch(certsUrl)
    if (!response.ok) throw new Error(`Access certs answered ${response.status}`)
    const jwks = Schema.decodeUnknownSync(Jwks)(await response.json(), {
      onExcessProperty: "ignore",
    })
    const keys = await Promise.all(
      jwks.keys.map(
        async ({ kid, kty, n, e }) =>
          [
            kid,
            await crypto.subtle.importKey("jwk", { kty, n, e }, rs256, false, ["verify"]),
          ] as const,
      ),
    )
    return { keys: new Map(keys), fetchedAt: Date.now() }
  }

  const refresh = () => {
    const pending = fetchKeys()
    cached = pending
    // A failed fetch is not cached: the next request tries again.
    pending.catch(() => {
      if (cached === pending) cached = undefined
    })
    return pending
  }

  const keyFor = async (kid: string): Promise<CryptoKey | undefined> => {
    let set = await (cached ?? refresh())
    if (Date.now() - set.fetchedAt > keysTtlMs) set = await refresh()
    const key = set.keys.get(kid)
    if (key !== undefined || Date.now() - set.fetchedAt < refetchCooldownMs) return key
    return (await refresh()).keys.get(kid)
  }

  /** True only for a token that passes every check. Never throws. */
  return async (token: string): Promise<boolean> => {
    try {
      const parts = token.split(".")
      if (parts.length !== 3) return false
      const [headerPart = "", payloadPart = "", signaturePart = ""] = parts
      const header = decodeSegment(Header, headerPart)
      const claims = decodeSegment(Claims, payloadPart)
      const signature = base64urlDecode(signaturePart)
      if (Option.isNone(header) || Option.isNone(claims) || signature === undefined) return false

      const { aud, iss, exp, nbf } = claims.value
      const now = Date.now() / 1000
      const audiences: ReadonlyArray<string> = typeof aud === "string" ? [aud] : aud
      if (!audiences.includes(config.aud) || iss !== issuer) return false
      if (exp + leewaySeconds <= now || (nbf !== undefined && nbf - leewaySeconds > now))
        return false

      const key = await keyFor(header.value.kid)
      if (key === undefined) return false
      return await crypto.subtle.verify(
        rs256,
        key,
        signature,
        new TextEncoder().encode(`${headerPart}.${payloadPart}`),
      )
    } catch {
      return false
    }
  }
}
