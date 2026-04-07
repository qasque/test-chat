/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHATWOOT_URL?: string;
  readonly VITE_BRIDGE_URL?: string;
  readonly VITE_CHATWOOT_ACCOUNT_ID?: string;
  /** Полный URL для пункта «Заметки», если не совпадает с инбоксом (кастомный Chatwoot) */
  readonly VITE_CHATWOOT_NOTES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
