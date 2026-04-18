/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHATWOOT_URL?: string;
  readonly VITE_CHATWOOT_ACCOUNT_ID?: string;
  readonly VITE_CHATWOOT_NOTES_URL?: string;
  readonly VITE_PORTAL_UI_MODE?: string;
  readonly VITE_BRIDGE_URL?: string;
  readonly VITE_AIBOT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
