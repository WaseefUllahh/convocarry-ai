/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHROME_STORE_URL: string;
  readonly VITE_DEMO_VIDEO_URL: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
