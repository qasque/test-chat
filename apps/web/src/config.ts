declare global {
  interface Window {
    __APP_CONFIG__?: {
      CHATWOOT_URL?: string;
      CHATWOOT_ACCOUNT_ID?: string;
      CHATWOOT_NOTES_URL?: string;
    };
  }
}

export function getChatwootUrl(): string {
  const fromEnv = import.meta.env.VITE_CHATWOOT_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const w = typeof window !== "undefined" ? window.__APP_CONFIG__?.CHATWOOT_URL : undefined;
  if (w) return w.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
}

/** Номер аккаунта из URL Chatwoot (`/app/accounts/1/...`). В Docker подставляется из CHATWOOT_ACCOUNT_ID. */
export function getChatwootAccountId(): string {
  const fromEnv = import.meta.env.VITE_CHATWOOT_ACCOUNT_ID;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  const w =
    typeof window !== "undefined"
      ? window.__APP_CONFIG__?.CHATWOOT_ACCOUNT_ID
      : undefined;
  if (w && String(w).trim()) return String(w).trim();
  return "1";
}

/** Необязательный URL для пункта «Заметки» (например кастомное представление в форке Chatwoot). */
export function getChatwootNotesUrlOverride(): string | undefined {
  const fromEnv = import.meta.env.VITE_CHATWOOT_NOTES_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, "");
  const w =
    typeof window !== "undefined"
      ? window.__APP_CONFIG__?.CHATWOOT_NOTES_URL
      : undefined;
  if (w && w.trim()) return w.trim().replace(/\/$/, "");
  return undefined;
}

/** Базовый URL моста без суффикса (прокси /api/bridge или прямой :4000) */
export function getBridgeBaseUrl(): string {
  const direct = import.meta.env.VITE_BRIDGE_URL;
  if (direct) return direct.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    return "http://127.0.0.1:4000";
  }
  return "/api/bridge";
}

/** Полный путь API моста, напр. /admin/bots */
export function getBridgeApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getBridgeBaseUrl()}${p}`;
}

/** Путь к /health моста */
export function getBridgeHealthUrl(): string {
  return getBridgeApiUrl("/health");
}
