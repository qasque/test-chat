declare global {
  interface Window {
    __APP_CONFIG__?: { CHATWOOT_URL?: string };
  }
}

export function getChatwootUrl(): string {
  const fromEnv = import.meta.env.VITE_CHATWOOT_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const w = typeof window !== "undefined" ? window.__APP_CONFIG__?.CHATWOOT_URL : undefined;
  if (w) return w.replace(/\/$/, "");
  return "http://127.0.0.1:3000";
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
