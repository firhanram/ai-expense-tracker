import { describe, expect, it } from "vitest"
import { signAccessToken } from "../../testing/access.ts"
import { callWorker, deployedOrigin } from "../../testing/callWorker.ts"
import { anError, readError } from "../../testing/envelope.ts"

// Access's cookie rides along with any request the browser sends to the app,
// a cross-site form POST included, so an unsafe method must come from the
// app's own pages (ADR-0011).
const nasiGoreng = JSON.stringify({
  amount: 25000,
  categoryId: 2,
  merchant: "Warung Bu Tini",
  note: null,
  occurredAt: "2026-11-20",
})

/** A signed-in `POST /api/expenses` carrying `headers`. */
const postExpense = async (headers: Record<string, string>, origin = deployedOrigin) =>
  callWorker(
    "/api/expenses",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-access-jwt-assertion": await signAccessToken(),
        ...headers,
      },
      body: nasiGoreng,
    },
    origin,
  )

const outcome = async (response: Response) => ({
  status: response.status,
  error: await readError(response),
})

const refused = { status: 403, error: anError("CROSS_SITE_REQUEST") }

describe("the same-origin guard", () => {
  it("accepts a POST the app's own page sent", async () => {
    const response = await postExpense({ "sec-fetch-site": "same-origin" })

    expect(response.status).toBe(201)
  })

  it.each(["cross-site", "same-site", "none"])(
    "refuses a POST whose Sec-Fetch-Site is %s",
    async (site) => {
      expect(await outcome(await postExpense({ "sec-fetch-site": site }))).toEqual(refused)
    },
  )

  it("accepts a POST without Sec-Fetch-Site whose Origin is the app's", async () => {
    const response = await postExpense({ origin: deployedOrigin })

    expect(response.status).toBe(201)
  })

  it("refuses a POST without Sec-Fetch-Site from another Origin", async () => {
    expect(await outcome(await postExpense({ origin: "https://evil.example" }))).toEqual(refused)
  })

  it("refuses a POST with neither header", async () => {
    expect(await outcome(await postExpense({}))).toEqual(refused)
  })

  it.each(["PATCH", "PUT", "DELETE"])("guards %s too", async (method) => {
    const response = await callWorker("/api/expenses/any-id", {
      method,
      headers: {
        "cf-access-jwt-assertion": await signAccessToken(),
        "sec-fetch-site": "cross-site",
      },
    })

    expect(await outcome(response)).toEqual(refused)
  })

  it("leaves a cross-site GET alone", async () => {
    const response = await callWorker("/api/expenses", {
      headers: {
        "cf-access-jwt-assertion": await signAccessToken(),
        "sec-fetch-site": "cross-site",
      },
    })

    expect(response.status).toBe(200)
  })

  it("guards the loopback host too", async () => {
    const response = await postExpense({ "sec-fetch-site": "cross-site" }, "http://localhost:1337")

    expect(await outcome(response)).toEqual(refused)
  })
})
