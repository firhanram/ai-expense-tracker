import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { makeHandler } from "../../App.ts"
import { makeSigningKey, signAccessToken } from "../../testing/access.ts"
import { callApi, callWorker, deployedOrigin } from "../../testing/callWorker.ts"
import { anError, readError } from "../../testing/envelope.ts"

// Any path other than health is protected; the Expenses list stands in for them.
const protectedPath = "/api/expenses"

const withToken = (token: string) => ({ headers: { "cf-access-jwt-assertion": token } })

/** Status and error, to compare with `refused`. */
const outcome = async (response: Response) => ({
  status: response.status,
  error: await readError(response),
})

const refused = { status: 401, error: anError("UNAUTHORIZED") }

describe("Cloudflare Access token", () => {
  it("lets a valid token through to the route", async () => {
    const response = await callApi(protectedPath)

    expect(response.status).toBe(200)
  })

  it("refuses a request without the header", async () => {
    expect(await outcome(await callWorker(protectedPath))).toEqual(refused)
  })

  it("refuses a token for another application's AUD", async () => {
    const token = await signAccessToken({ aud: ["another-app-aud"] })

    expect(await outcome(await callWorker(protectedPath, withToken(token)))).toEqual(refused)
  })

  it("refuses a token from another issuer", async () => {
    const token = await signAccessToken({ iss: "https://another-team.cloudflareaccess.com" })

    expect(await outcome(await callWorker(protectedPath, withToken(token)))).toEqual(refused)
  })

  it("refuses an expired token", async () => {
    const token = await signAccessToken({ exp: Math.floor(Date.now() / 1000) - 3600 })

    expect(await outcome(await callWorker(protectedPath, withToken(token)))).toEqual(refused)
  })

  it("refuses a token not signed by the team's key", async () => {
    // Same key id as the team's, so only the signature can tell it apart.
    const forger = await makeSigningKey("test-team-key")
    const token = await signAccessToken({}, forger)

    expect(await outcome(await callWorker(protectedPath, withToken(token)))).toEqual(refused)
  })

  it("refuses a token signed by a key the team never published", async () => {
    const token = await signAccessToken({}, await makeSigningKey("unpublished-key"))

    expect(await outcome(await callWorker(protectedPath, withToken(token)))).toEqual(refused)
  })

  it("refuses a header that is not a token", async () => {
    expect(await outcome(await callWorker(protectedPath, withToken("not-a-jwt")))).toEqual(refused)
  })

  it("covers paths no route matches, so they reveal nothing", async () => {
    expect(await outcome(await callWorker("/api/nowhere"))).toEqual(refused)
  })

  it("leaves health open without a token", async () => {
    const response = await callWorker("/api/health")

    expect(response.status).toBe(200)
  })

  it.each(["http://localhost:1337", "http://127.0.0.1:1337"])(
    "exempts the loopback host %s, which only `alchemy dev` sees",
    async (origin) => {
      const response = await callWorker(protectedPath, undefined, origin)

      expect(response.status).toBe(200)
    },
  )

  const { ACCESS_TEAM_DOMAIN: _team, ACCESS_AUD: _aud, ...unconfigured } = env

  it.each([
    ["ACCESS_TEAM_DOMAIN is unset", { ...unconfigured, ACCESS_AUD: env.ACCESS_AUD }],
    ["ACCESS_AUD is unset", { ...unconfigured, ACCESS_TEAM_DOMAIN: env.ACCESS_TEAM_DOMAIN }],
    ["ACCESS_AUD is empty", { ...env, ACCESS_AUD: "" }],
  ])("refuses even a valid token when %s", async (_, misconfigured) => {
    const app = makeHandler(misconfigured)
    try {
      const response = await app.handler(
        new Request(`${deployedOrigin}${protectedPath}`, withToken(await signAccessToken())),
        undefined,
      )

      expect(await outcome(response)).toEqual(refused)
    } finally {
      await app.dispose()
    }
  })
})
