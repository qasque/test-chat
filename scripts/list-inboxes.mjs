#!/usr/bin/env node
/**
 * List Chatwoot inboxes (needs CHATWOOT_API_ACCESS_TOKEN in repo root .env).
 *   node scripts/list-inboxes.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error("Create .env from .env.example");
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const base =
  process.env.CHATWOOT_PUBLIC_URL ||
  process.env.FRONTEND_URL ||
  "http://127.0.0.1:3000";
const token = process.env.CHATWOOT_API_ACCESS_TOKEN;
const accountId = process.env.CHATWOOT_ACCOUNT_ID || "1";

if (!token) {
  console.error("Set CHATWOOT_API_ACCESS_TOKEN in .env");
  process.exit(1);
}

const url = `${base.replace(/\/$/, "")}/api/v1/accounts/${accountId}/inboxes`;

const res = await fetch(url, {
  headers: { api_access_token: token },
});

if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const list = data.payload || data;
console.log(JSON.stringify(list, null, 2));
