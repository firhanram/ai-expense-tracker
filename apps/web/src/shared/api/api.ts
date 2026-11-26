import { createApi } from "./client.ts"

/** The app's one API caller: same origin as the Worker, token baked in at build time. */
export const api = createApi({
  baseUrl: window.location.origin,
  token: import.meta.env.VITE_API_TOKEN,
})
