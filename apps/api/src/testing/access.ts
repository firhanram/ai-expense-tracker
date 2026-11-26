import { env } from "cloudflare:workers"
import { vi } from "vitest"

/**
 * A stand-in for the Cloudflare Access team: a signing key the tests own, and
 * its JWKS served at the team's certs URL by a stubbed `fetch`, so no test
 * reaches the network. Bound in `vitest.config.ts` as `ACCESS_TEAM_DOMAIN`
 * and `ACCESS_AUD`.
 */
export const testTeamDomain = env.ACCESS_TEAM_DOMAIN ?? ""
export const testAud = env.ACCESS_AUD ?? ""
export const testIssuer = `https://${testTeamDomain}`
const certsUrl = `${testIssuer}/cdn-cgi/access/certs`

const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const

/** A fresh RS256 key pair under `kid`. */
export const makeSigningKey = async (kid: string) => {
  const pair = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"])
  if (!("privateKey" in pair)) throw new Error("RSA key generation gave no key pair")
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey)
  if (publicJwk instanceof ArrayBuffer) throw new Error("JWK export gave raw bytes")
  return {
    kid,
    privateKey: pair.privateKey,
    publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" },
  }
}

export type SigningKey = Awaited<ReturnType<typeof makeSigningKey>>

/** The team's one published key. */
export const teamKey = await makeSigningKey("test-team-key")

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")

const encodeJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)))

const nowSeconds = () => Math.floor(Date.now() / 1000)

/**
 * A signed Access token. Valid by default: the team's key, the app's AUD, the
 * team issuer, an hour left. `claims` overrides or adds payload fields.
 */
export const signAccessToken = async (
  claims: Record<string, unknown> = {},
  key: SigningKey = teamKey,
) => {
  const header = encodeJson({ alg: "RS256", kid: key.kid, typ: "JWT" })
  const payload = encodeJson({
    aud: [testAud],
    iss: testIssuer,
    sub: "owner-user-id",
    email: "owner@example.com",
    iat: nowSeconds(),
    exp: nowSeconds() + 3600,
    ...claims,
  })
  const signingInput = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    algorithm.name,
    key.privateKey,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

/** Setup file: answers the team's certs URL with `teamKey`, passing every other request on. */
export const serveTeamKeys = () => {
  const realFetch = globalThis.fetch
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    return url === certsUrl
      ? Promise.resolve(Response.json({ keys: [teamKey.publicJwk] }))
      : realFetch(input, init)
  })
}
