import { describe, expect, it } from "vitest"
import { callApi } from "./testing/callWorker.ts"
import { anError, readError } from "./testing/envelope.ts"

describe("unknown routes", () => {
  it("return 404 NOT_FOUND", async () => {
    const response = await callApi("/api/does-not-exist")

    expect(response.status).toBe(404)
    expect(await readError(response)).toEqual(anError("NOT_FOUND"))
  })
})
