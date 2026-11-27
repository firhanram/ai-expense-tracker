/**
 * Cloudflare Access signs the owner in (ADR-0011). When that session expires,
 * Access answers an API call with a redirect to its login page instead of
 * JSON. Not followed (`redirect: "manual"`), that redirect arrives as an
 * `opaqueredirect` response; followed, it would fail as a cross-origin
 * request and look like a network error. So the API's `fetch` never follows
 * one, and treats it as "signed out": it reloads the page, which Access then
 * sends to the login screen, and never settles, so nothing shows an error in
 * the moment before the page goes.
 *
 * A real answer from the Worker, a `401 UNAUTHORIZED` included, passes through:
 * reloading on it could loop, and it is not an expired session.
 */
/** What a `401 UNAUTHORIZED` says: there is no token to check, only an Access session to renew. */
export const notSignedIn = "Not signed in. Reload to sign in again."

export const reloadWhenSignedOut =
  (fetch: typeof globalThis.fetch, reload: () => void): typeof globalThis.fetch =>
  async (input, init) => {
    const response = await fetch(input, { ...init, redirect: "manual" })
    if (response.type !== "opaqueredirect") return response
    reload()
    return new Promise<never>(() => {})
  }
