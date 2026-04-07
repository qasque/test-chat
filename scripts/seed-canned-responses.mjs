#!/usr/bin/env node
/**
 * Создаёт (или обновляет) быстрые ответы Chatwoot по темам vpn1/vpn2/vpn3.
 *
 * Запуск из корня проекта:
 *   node scripts/seed-canned-responses.mjs
 *
 * Требует в .env:
 *   CHATWOOT_API_ACCESS_TOKEN
 *   CHATWOOT_ACCOUNT_ID
 *   CHATWOOT_PUBLIC_URL (или FRONTEND_URL)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error("Создайте .env из .env.example");
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
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
  console.error("Нужен CHATWOOT_API_ACCESS_TOKEN в .env");
  process.exit(1);
}

const apiBase = `${base.replace(/\/$/, "")}/api/v1/accounts/${accountId}`;

const templates = [
  // vpn1
  {
    short_code: "vpn1_greeting",
    content:
      "Здравствуйте! Поддержка VPN1 на связи. Опишите, пожалуйста, проблему: устройство, страна, и на каком шаге возникает ошибка.",
  },
  {
    short_code: "vpn1_not_connecting",
    content:
      "VPN1: проверим подключение.\n1) Перезапустите приложение.\n2) Смените сервер/локацию.\n3) Отключите другие VPN/прокси.\nЕсли не поможет — пришлите скрин ошибки.",
  },
  {
    short_code: "vpn1_logs",
    content:
      "VPN1: пришлите, пожалуйста:\n- скрин ошибки,\n- модель устройства и ОС,\n- время последней неудачной попытки,\n- страну и выбранный сервер.",
  },
  // vpn2
  {
    short_code: "vpn2_greeting",
    content:
      "Здравствуйте! Поддержка VPN2 на связи. Помогу разобраться. Уточните, пожалуйста, в какой момент возникает проблема.",
  },
  {
    short_code: "vpn2_not_connecting",
    content:
      "VPN2: попробуйте базовую диагностику.\n1) Обновите приложение до последней версии.\n2) Переключите протокол/сервер.\n3) Перезагрузите устройство.\nЕсли ошибка сохраняется — пришлите скрин.",
  },
  {
    short_code: "vpn2_subscription",
    content:
      "VPN2: для проверки подписки укажите email/ID аккаунта и дату оплаты. Проверим статус и сразу вернёмся с ответом.",
  },
  // vpn3
  {
    short_code: "vpn3_greeting",
    content:
      "Здравствуйте! Вы в поддержке VPN3. Подскажите, пожалуйста, что не работает: вход, подключение, скорость или оплата?",
  },
  {
    short_code: "vpn3_not_connecting",
    content:
      "VPN3: давайте быстро проверим.\n1) Включите/выключите авиарежим.\n2) Смените сервер на соседний регион.\n3) Отключите экономию батареи для приложения.\nСообщите результат.",
  },
  {
    short_code: "vpn3_escalation",
    content:
      "Передаю запрос в технический отдел VPN3. Обычно ответ занимает до 24 часов. Как только получим результат, сразу напишем вам.",
  },
];

function pickList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.payload)) return data.payload;
  return [];
}

function pickShortCode(item) {
  return (
    item?.short_code ||
    item?.shortCode ||
    item?.shortcut ||
    item?.name ||
    ""
  );
}

function buildBody(tpl) {
  // Для разных версий Chatwoot набор полей немного отличается.
  return {
    short_code: tpl.short_code,
    content: tpl.content,
  };
}

async function getAllCanned() {
  const url = `${apiBase}/canned_responses`;
  const res = await fetch(url, {
    headers: { api_access_token: token },
  });
  if (!res.ok) {
    throw new Error(`GET canned_responses failed: ${res.status} ${await res.text()}`);
  }
  return pickList(await res.json());
}

async function createCanned(tpl) {
  const url = `${apiBase}/canned_responses`;
  const body = buildBody(tpl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      api_access_token: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `POST canned_responses(${tpl.short_code}) failed: ${res.status} ${await res.text()}`
    );
  }
  return res.json();
}

async function updateCanned(id, tpl) {
  const url = `${apiBase}/canned_responses/${id}`;
  const body = buildBody(tpl);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      api_access_token: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `PUT canned_responses/${id}(${tpl.short_code}) failed: ${res.status} ${await res.text()}`
    );
  }
  return res.json();
}

const existing = await getAllCanned();
const byCode = new Map(
  existing
    .map((x) => [pickShortCode(x), x])
    .filter(([k]) => typeof k === "string" && k.length > 0)
);

let created = 0;
let updated = 0;
for (const tpl of templates) {
  const current = byCode.get(tpl.short_code);
  if (!current?.id) {
    await createCanned(tpl);
    created += 1;
    console.log(`created: ${tpl.short_code}`);
  } else {
    await updateCanned(current.id, tpl);
    updated += 1;
    console.log(`updated: ${tpl.short_code}`);
  }
}

console.log(`Done. created=${created}, updated=${updated}, total=${templates.length}`);
