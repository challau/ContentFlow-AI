/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base (e.g. https://app.example.com/api/v1). Same-origin when unset. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
