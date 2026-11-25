import worker from "../index.ts"

/**
 * S1 seam: calls the Worker's fetch handler in workerd against the local D1.
 * No socket, no deploy.
 */
export const callWorker = (path: string, init?: RequestInit) =>
  worker.fetch(new Request(`http://localhost${path}`, init))
