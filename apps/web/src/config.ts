export type PortalUiMode = "full" | "operator";

declare global {
  interface Window {
    __APP_CONFIG__?: {
      CHATWOOT_URL?: string;
      CHATWOOT_ACCOUNT_ID?: string;
      CHATWOOT_NOTES_URL?: string;
      /** `operator` — только встроенный Chatwoot (вход + диалоги), без вкладок портала. */
      PORTAL_UI_MODE?: PortalUiMode | string;
    };
  }
}

/** Портал: полный (статус, настройка, …) или минимальный для оператора. */
export function getPortalUiMode(): PortalUiMode {
  const fromEnv = import.meta.env.VITE_PORTAL_UI_MODE;
  if (fromEnv === "operator" || fromEnv === "full") return fromEnv;
  const w =
    typeof window !== "undefined"
      ? window.__APP_CONFIG__?.PORTAL_UI_MODE
      : undefined;
  const s = w != null ? String(w).trim().toLowerCase() : "";
  if (s === "operator" || s === "full") return s as PortalUiMode;
  return "full";
}

export function getChatwootUrl(): string {
  const fromEnv = import.meta.env.VITE_CHATWOOT_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const w = typeof window !== "undefined" ? window.__APP_CONFIG__?.CHATWOOT_URL : undefined;
  if (w) return w.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
}

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

/** Optional URL for the Notes shortcut (custom Chatwoot fork). */
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

export function getBridgeBaseUrl(): string {
  const direct = import.meta.env.VITE_BRIDGE_URL;
  if (direct) return direct.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    return "http://127.0.0.1:4000";
  }
  return "/api/bridge";
}

export function getBridgeApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getBridgeBaseUrl()}${p}`;
}

export function getBridgeHealthUrl(): string {
  return getBridgeApiUrl("/health");
}

export function getAiBotBaseUrl(): string {
  const direct = import.meta.env.VITE_AIBOT_URL;
  if (direct) return direct.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    return "http://127.0.0.1:5005";
  }
  return "/api/ai-bot";
}

export function getAiBotHealthUrl(): string {
  return `${getAiBotBaseUrl()}/health`;
}
