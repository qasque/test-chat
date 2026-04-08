#!/usr/bin/env node
/**
 * Validate required .env keys before stack or demo.
 *   node scripts/validate-env.mjs
 *   node scripts/validate-env.mjs --bridge   # + CHATWOOT_API_ACCESS_TOKEN
 *   node scripts/validate-env.mjs --demo      # + Telegram demo profile
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

const wantDemo = process.argv.includes("--demo");
const wantBridge = wantDemo || process.argv.includes("--bridge");

function loadEnvFile() {
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env — copy .env.example to .env");
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim().replace(/^["']|["']$/g, "");
    env[k] = v;
  }
  return env;
}

const env = loadEnvFile();
const missing = [];

function need(key, cond = true) {
  if (!cond) return;
  const v = env[key];
  if (v === undefined || v === "" || v.startsWith("replace_") || v === "change_me_redis_strong" || v === "change_me_postgres_strong" || v === "change_me_long_random_for_telegram_webhook_auth") {
    missing.push(key);
  }
}

need("SECRET_KEY_BASE");
need("POSTGRES_PASSWORD");
need("REDIS_PASSWORD");
need("REDIS_URL");
if (wantBridge) {
  need("CHATWOOT_API_ACCESS_TOKEN");
}

if (wantDemo) {
  need("TELEGRAM_BOT_TOKEN");
  need("TELEGRAM_BOTS_JSON");
  const j = env.TELEGRAM_BOTS_JSON;
  if (j) {
    try {
      const parsed = JSON.parse(j);
      const key = env.TELEGRAM_BOT_KEY || "demo_bot";
      if (!parsed[key]?.inboxId || !parsed[key]?.token) {
        console.error(
          `TELEGRAM_BOTS_JSON must include key "${key}" with inboxId and token.`
        );
        process.exit(1);
      }
    } catch {
      console.error("TELEGRAM_BOTS_JSON is not valid JSON");
      process.exit(1);
    }
  }
}

if (missing.length) {
  console.error("Set in .env:", missing.join(", "));
  process.exit(1);
}

console.log(
  ".env OK",
  wantDemo ? "(--demo)" : wantBridge ? "(--bridge)" : ""
);
