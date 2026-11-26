/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The bearer token for `/api/*`, set at build time. Absent when the deployment sends none. */
  readonly VITE_API_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
