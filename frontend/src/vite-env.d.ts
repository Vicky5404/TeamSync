/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_UPLOAD_MAX_FILE_SIZE_MB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
