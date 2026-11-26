import { createExecutionContext } from "cloudflare:test"
import { env } from "cloudflare:workers"
import worker from "../index.ts"
import { signAccessToken } from "./access.ts"

/**
 * The origin tests call as. Not loopback, so the Access check applies: only
 * `alchemy dev` is exempt (ADR-0011), and a test that passed only because of
 * that exemption would prove nothing about the deployed Worker.
 */
export const deployedOrigin = "https://expenses.example.com"

/**
 * S1 seam: calls the Worker's fetch handler in workerd against the local D1.
 * No socket, no deploy. Sends no Access token; `callApi` is the authorised call.
 */
export const callWorker = (path: string, init?: RequestInit, origin = deployedOrigin) =>
  worker.fetch(new Request(`${origin}${path}`, init), env, createExecutionContext())

/**
 * `init` as the owner's browser sends it from the app's own page
 * (`Sec-Fetch-Site: same-origin`), with the valid `Cf-Access-Jwt-Assertion`
 * Access adds at the edge.
 */
export const withAccessToken = async (init?: RequestInit): Promise<RequestInit> => {
  const headers = new Headers(init?.headers)
  headers.set("sec-fetch-site", "same-origin")
  headers.set("cf-access-jwt-assertion", await signAccessToken())
  return { ...init, headers }
}

/** `callWorker` as the signed-in owner reaches it: through Access, with its token. */
export const callApi = async (path: string, init?: RequestInit) =>
  callWorker(path, await withAccessToken(init))
