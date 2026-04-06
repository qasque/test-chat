import fs from "fs";
import path from "path";

const RUNTIME_PATH =
  process.env.BRIDGE_RUNTIME_BOTS_PATH || "/data/telegram-bots-runtime.json";

function loadEnvBots() {
  const raw = process.env.TELEGRAM_BOTS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.error("TELEGRAM_BOTS_JSON: невалидный JSON");
    return {};
  }
}

function loadRuntimeFile() {
  try {
    const raw = fs.readFileSync(RUNTIME_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Env + runtime-файл.
 * - inboxId из TELEGRAM_BOTS_JSON важнее runtime (чтобы не ловить 404 из‑за старого файла на диске).
 * - token: если задан в runtime (портал), он используется; иначе из env.
 */
export function getBots() {
  const env = loadEnvBots();
  const runtime = loadRuntimeFile();
  const keys = new Set([
    ...Object.keys(env),
    ...Object.keys(runtime),
  ]);
  const out = {};
  for (const k of keys) {
    const e =
      env[k] && typeof env[k] === "object" ? env[k] : {};
    const r =
      runtime[k] && typeof runtime[k] === "object" ? runtime[k] : {};
    const merged = { ...e, ...r };
    if (
      e.inboxId != null &&
      Number.isFinite(Number(e.inboxId)) &&
      Number(e.inboxId) >= 1
    ) {
      merged.inboxId = Number(e.inboxId);
    }
    const rt = r.token != null ? String(r.token).trim() : "";
    const et = e.token != null ? String(e.token).trim() : "";
    merged.token = rt || et;
    out[k] = merged;
  }
  return out;
}

export function mergeAndSaveRuntime(partial) {
  if (!partial || typeof partial !== "object") {
    throw new Error("Нужен объект ботов");
  }
  const current = loadRuntimeFile();
  const next = { ...current, ...partial };
  const dir = path.dirname(path.resolve(RUNTIME_PATH));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(next, null, 0), "utf8");
  return next;
}

export function maskBots(bots) {
  const out = {};
  for (const [k, v] of Object.entries(bots)) {
    if (!v || typeof v !== "object") continue;
    const token = String(v.token || "");
    const masked =
      token.length <= 4
        ? "****"
        : `${"*".repeat(Math.min(8, token.length - 4))}${token.slice(-4)}`;
    out[k] = {
      inboxId: v.inboxId,
      tokenMasked: masked,
      hasToken: Boolean(token),
    };
  }
  return out;
}
