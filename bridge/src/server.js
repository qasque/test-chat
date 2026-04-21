import "dotenv/config";
import express from "express";
import crypto from "crypto";
import axios from "axios";
import { createChatwootClient } from "./chatwoot.js";
import { mountMobileGateway } from "./mobile-gateway.js";
import { openStore } from "./store.js";
import { openOutboundQueue } from "./outbound-queue.js";
import {
  getBots,
  mergeAndSaveRuntime,
  maskBots,
} from "./bots-config.js";

const PORT = Number(process.env.BRIDGE_PORT || 4000);
const BRIDGE_SECRET = (process.env.BRIDGE_SECRET || "").trim();
const CHATWOOT_WEBHOOK_SECRET = process.env.CHATWOOT_WEBHOOK_SECRET || "";
const CHATWOOT_BASE =
  process.env.CHATWOOT_INTERNAL_URL ||
  process.env.CHATWOOT_BASE_URL ||
  "http://rails:3000";
const ACCOUNT_ID = Number(process.env.CHATWOOT_ACCOUNT_ID || 1);
const API_TOKEN = process.env.CHATWOOT_API_ACCESS_TOKEN || "";

const DB_PATH = process.env.BRIDGE_DB_PATH || "/data/telegram-threads.json";
const OUTBOUND_QUEUE_PATH =
  process.env.BRIDGE_OUTBOUND_QUEUE_PATH || "/data/telegram-outbound-queue.json";
/** Повтор отправки в Telegram при ошибке; между тиками setInterval. */
const RETRY_INTERVAL_MS = Number(process.env.BRIDGE_TELEGRAM_RETRY_MS || 5000);
const TELEGRAM_SEND_MAX_ATTEMPTS = Number(
  process.env.BRIDGE_TELEGRAM_MAX_ATTEMPTS || 12
);

/** Уведомление о новом диалоге (событие Chatwoot conversation_created). */
const BRIDGE_NEW_CONV_HOOK_URL = (
  process.env.BRIDGE_NEW_CONV_HOOK_URL || ""
).trim();
const BRIDGE_NEW_CONV_NOTIFY_BOT_TOKEN = (
  process.env.BRIDGE_NEW_CONV_NOTIFY_BOT_TOKEN || ""
).trim();
const BRIDGE_NEW_CONV_NOTIFY_CHAT_ID = (
  process.env.BRIDGE_NEW_CONV_NOTIFY_CHAT_ID || ""
).trim();
/** Публичный URL панели Chatwoot (без /) — в Telegram добавится ссылка на диалог. */
const BRIDGE_NOTIFICATION_CHATWOOT_BASE_URL = (
  process.env.BRIDGE_NOTIFICATION_CHATWOOT_BASE_URL ||
  process.env.FRONTEND_URL ||
  ""
).trim();
/**
 * Когда слать уведомление о диалоге:
 * - operator — только когда диалог у оператора (assignee или custom ai_handoff), не на каждое сообщение;
 * - first_message — первое входящее (messages_count === 1);
 * - both — любое из двух (один раз на диалог из‑за dedup).
 */
const BRIDGE_NEW_CONV_NOTIFY_MODE = (
  process.env.BRIDGE_NEW_CONV_NOTIFY_MODE || "operator"
)
  .trim()
  .toLowerCase();

const threadCreationLocks = new Map();
/** Чтобы не дублировать уведомление, если пришли и conversation_created, и первое message_created. */
const newConversationNotifyDedup = new Set();

function requireSecret(req, res, next) {
  if (!BRIDGE_SECRET) return next();
  const h = (req.get("X-Bridge-Secret") || "").trim();
  if (h !== BRIDGE_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

function requireAdminSecret(req, res, next) {
  if (!BRIDGE_SECRET) {
    return res.status(503).json({
      error: "BRIDGE_SECRET не задан — задайте в .env и перезапустите мост",
    });
  }
  const h = (req.get("X-Bridge-Secret") || "").trim();
  if (h !== BRIDGE_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

function adminCors(req, res, next) {
  if (!req.path.startsWith("/admin")) return next();
  const origin = process.env.BRIDGE_CORS_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Bridge-Secret"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
}

function verifyChatwootWebhook(req, res, next) {
  if (!CHATWOOT_WEBHOOK_SECRET || !req.rawBody) return next();
  const sig = req.get("X-Chatwoot-Signature");
  const ts = req.get("X-Chatwoot-Timestamp");
  if (!sig || !ts) {
    return res.status(401).json({ error: "missing_signature_headers" });
  }
  const message = `${ts}.${req.rawBody.toString("utf8")}`;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", CHATWOOT_WEBHOOK_SECRET)
      .update(message)
      .digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "invalid_signature" });
    }
  } catch {
    return res.status(401).json({ error: "invalid_signature" });
  }
  return next();
}

function isOutgoingMessage(message) {
  const mt = message?.message_type;
  if (mt === "outgoing") return true;
  if (mt === 1 || mt === "1") return true;
  return false;
}

const cw = createChatwootClient({
  baseUrl: CHATWOOT_BASE,
  apiAccessToken: API_TOKEN,
  accountId: ACCOUNT_ID,
});

const store = openStore(DB_PATH);
const outboundQueue = openOutboundQueue(OUTBOUND_QUEUE_PATH);

const app = express();
app.use(adminCors);
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

mountMobileGateway(app, CHATWOOT_BASE);

function allowHealthCors(req, res, next) {
  const origin = process.env.BRIDGE_CORS_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  next();
}

app.options("/health", allowHealthCors, (_req, res) => {
  res.sendStatus(204);
});

app.get("/health", allowHealthCors, (_req, res) => {
  res.json({
    ok: true,
    service: "telegram-bridge",
    outboundQueueSize: outboundQueue.list().length,
  });
});

async function sendTelegramMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const { data } = await axios.post(url, { chat_id: chatId, text });
  return data?.result?.message_id ?? null;
}

async function sendTelegramMedia(token, chatId, attachment, caption) {
  const dataUrl = attachment?.data_url || attachment?.thumb_url;
  if (!dataUrl) return false;
  const contentType = String(attachment?.file_type || "").toLowerCase();
  const endpoint =
    contentType.startsWith("audio/ogg") || contentType.startsWith("audio/opus")
      ? "sendVoice"
      : contentType.startsWith("audio/")
      ? "sendAudio"
      : "sendDocument";
  const field =
    endpoint === "sendVoice"
      ? "voice"
      : endpoint === "sendAudio"
      ? "audio"
      : "document";
  const url = `https://api.telegram.org/bot${token}/${endpoint}`;
  const { data } = await axios.post(url, {
    chat_id: chatId,
    [field]: dataUrl,
    caption: caption || undefined,
  });
  return data?.result?.message_id ?? null;
}

async function deleteTelegramMessage(token, chatId, telegramMessageId) {
  const url = `https://api.telegram.org/bot${token}/deleteMessage`;
  const { data } = await axios.post(url, {
    chat_id: chatId,
    message_id: Number(telegramMessageId),
  });
  return data?.ok === true;
}

function extractChatwootMessageId(apiResult) {
  const id =
    apiResult?.id ??
    apiResult?.message?.id ??
    apiResult?.payload?.id ??
    apiResult?.payload?.message?.id;
  return Number.isFinite(Number(id)) ? Number(id) : null;
}

function extractWebhookMessageId(reqBody, message) {
  const id =
    message?.id ??
    reqBody?.id ??
    reqBody?.message_id ??
    reqBody?.message?.id ??
    reqBody?.payload?.id;
  return Number.isFinite(Number(id)) ? Number(id) : null;
}

function buildNewConversationNotifyText(body) {
  const conv = body?.conversation || body;
  if (!conv?.id) return null;
  const displayId = conv.display_id ?? conv.id;
  const accId =
    conv.account_id ??
    body?.account?.id ??
    body?.account_id ??
    ACCOUNT_ID;
  const sender = conv.meta?.sender;
  const contact = body?.contact || sender || {};
  const name =
    contact.name ||
    contact.identifier ||
    contact.email ||
    contact.phone_number ||
    "Клиент";
  const inboxId = conv.inbox_id ?? "?";
  const reason = (body.notify_reason || "").trim();
  const title =
    reason === "operator"
      ? `Диалог #${displayId} у оператора`
      : `Новый диалог #${displayId}`;
  const lines = [title, `Контакт: ${name}`, `Inbox id: ${inboxId}`];
  const base = BRIDGE_NOTIFICATION_CHATWOOT_BASE_URL.replace(/\/$/, "");
  if (base) {
    lines.push(`${base}/app/accounts/${accId}/conversations/${conv.id}`);
  }
  return lines.join("\n");
}

async function notifyConversationCreated(body) {
  const conv = body?.conversation || body;
  const cid = conv?.id;
  if (cid != null) {
    const key = String(cid);
    if (newConversationNotifyDedup.has(key)) {
      console.log("[new_conv_notify] dedup skip conversation", key);
      return;
    }
  }
  const text = buildNewConversationNotifyText(body);
  if (!text) {
    console.warn(
      "[new_conv_notify] skip: no conversation in payload",
      body?.event
    );
    return;
  }
  if (cid != null) {
    newConversationNotifyDedup.add(String(cid));
    if (newConversationNotifyDedup.size > 3000) {
      newConversationNotifyDedup.clear();
    }
  }
  if (BRIDGE_NEW_CONV_HOOK_URL) {
    try {
      await axios.post(BRIDGE_NEW_CONV_HOOK_URL, body, {
        timeout: 15000,
        headers: { "Content-Type": "application/json" },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    } catch (e) {
      console.warn("[new_conv_notify] hook failed:", e.message);
    }
  }
  if (BRIDGE_NEW_CONV_NOTIFY_BOT_TOKEN && BRIDGE_NEW_CONV_NOTIFY_CHAT_ID) {
    try {
      await sendTelegramMessage(
        BRIDGE_NEW_CONV_NOTIFY_BOT_TOKEN,
        BRIDGE_NEW_CONV_NOTIFY_CHAT_ID,
        text
      );
    } catch (e) {
      console.warn("[new_conv_notify] telegram failed:", e.message);
    }
  }
  if (
    !BRIDGE_NEW_CONV_HOOK_URL &&
    (!BRIDGE_NEW_CONV_NOTIFY_BOT_TOKEN || !BRIDGE_NEW_CONV_NOTIFY_CHAT_ID)
  ) {
    console.log(
      "[new_conv_notify] no BRIDGE_NEW_CONV_HOOK_URL / NOTIFY_* — уведомление не отправлено"
    );
  }
}

/** Первое входящее сообщение клиента (message_created). */
function isFirstIncomingMessageInConversation(message) {
  if (!message || isOutgoingMessage(message)) return false;
  if (message.private === true || message.content_attributes?.private) {
    return false;
  }
  const c = message.conversation;
  if (!c?.id) return false;
  const count =
    c.messages_count ??
    c.meta?.messages_count ??
    c.meta?.all_messages_count;
  if (count == null || count === "") {
    return false;
  }
  return Number(count) === 1;
}

function conversationHasOperatorOrHandoff(conv) {
  if (!conv) return false;
  const assignee =
    conv.meta?.assignee?.id ??
    conv.assignee_id ??
    conv.assignee?.id;
  const h = conv.custom_attributes?.ai_handoff;
  const handoff =
    h === true ||
    h === "true" ||
    String(h || "").toLowerCase() === "true";
  return Boolean(assignee || handoff);
}

function notifyChannelsConfigured() {
  return Boolean(
    BRIDGE_NEW_CONV_HOOK_URL ||
      (BRIDGE_NEW_CONV_NOTIFY_BOT_TOKEN && BRIDGE_NEW_CONV_NOTIFY_CHAT_ID)
  );
}

function modeAllowsFirstMessage() {
  return (
    BRIDGE_NEW_CONV_NOTIFY_MODE === "first_message" ||
    BRIDGE_NEW_CONV_NOTIFY_MODE === "both"
  );
}

function modeAllowsOperator() {
  return (
    BRIDGE_NEW_CONV_NOTIFY_MODE === "operator" ||
    BRIDGE_NEW_CONV_NOTIFY_MODE === "both"
  );
}

/** Chatwoot soft-delete sets content_attributes.deleted (often message_updated, not message_deleted). */
function isMessageSoftDeleted(message) {
  const ca = message?.content_attributes;
  if (!ca || typeof ca !== "object") return false;
  return ca.deleted === true || ca.deleted === "true";
}

async function syncDeleteMessageToTelegram(chatwootMessageId, botsMap) {
  const link = store.getByChatwootMessageId(chatwootMessageId);
  if (!link?.telegram_message_id || !link?.bot_key) {
    return { ok: true, skipped: "no_link" };
  }
  const cfg = botsMap[link.bot_key];
  if (!cfg?.token) {
    return { ok: false, error: "missing_bot_token" };
  }
  await deleteTelegramMessage(
    cfg.token,
    link.chat_id,
    link.telegram_message_id
  );
  store.deleteByChatwootMessageId(chatwootMessageId);
  return { ok: true, deleted: true };
}

async function downloadTelegramMedia(token, media) {
  const fileId = media?.fileId;
  if (!fileId) {
    const err = new Error("media.fileId is required");
    err.status = 400;
    throw err;
  }
  const infoUrl = `https://api.telegram.org/bot${token}/getFile`;
  const { data: info } = await axios.get(infoUrl, {
    params: { file_id: fileId },
    timeout: 20000,
  });
  const filePath = info?.result?.file_path;
  if (!filePath) {
    const err = new Error("Telegram getFile: file_path missing");
    err.status = 502;
    throw err;
  }
  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const { data: binary } = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    timeout: 60000,
  });
  const buffer = Buffer.from(binary);
  const ext = filePath.includes(".") ? filePath.split(".").pop() : "bin";
  const baseName =
    media?.type === "voice"
      ? "voice"
      : media?.type === "audio"
      ? "audio"
      : media?.type === "video_note"
      ? "video_note"
      : "media";
  const fileName = media?.fileName || `${baseName}.${ext}`;
  const contentType =
    media?.mimeType ||
    (media?.type === "voice"
      ? "audio/ogg"
      : media?.type === "audio"
      ? "audio/mpeg"
      : "application/octet-stream");
  return { buffer, fileName, contentType };
}

async function processTelegramIncoming(body, botsMap) {
  const { botKey, chatId, text, media, userId, username, name, telegramMessageId } =
    body || {};
  if (!botKey || chatId == null || !text) {
    const err = new Error("Нужны поля botKey, chatId, text");
    err.status = 400;
    throw err;
  }

  const cfg = botsMap[botKey];
  if (!cfg?.inboxId || !cfg?.token) {
    const err = new Error(
      "Неизвестный botKey или не заданы inboxId/token (TELEGRAM_BOTS_JSON или портал)"
    );
    err.status = 400;
    throw err;
  }

  const inboxId = Number(cfg.inboxId);
  const identifier = `tg_${botKey}_${userId ?? chatId}`;
  const displayName =
    name ||
    (username ? `@${username}` : null) ||
    `Telegram ${userId ?? chatId}`;

  const lockKey = `${botKey}::${String(chatId)}`;

  let thread = store.getByTelegram(botKey, chatId);
  if (!thread) {
    let p = threadCreationLocks.get(lockKey);
    if (!p) {
      p = (async () => {
        let t = store.getByTelegram(botKey, chatId);
        if (t) return;

        const contact = await cw.getOrCreateContact({
          inboxId,
          name: displayName,
          identifier,
        });

        const conversations = await cw.listContactConversations(contact.id);
        let conversation =
          conversations.find((c) => c.inbox_id === inboxId) || null;

        if (!conversation) {
          conversation = await cw.createConversation({
            inboxId,
            contactId: contact.id,
            sourceId: identifier,
          });
        }

        store.saveThread({
          bot_key: botKey,
          chat_id: chatId,
          conversation_id: conversation.id,
          contact_id: contact.id,
        });
      })();
      threadCreationLocks.set(lockKey, p);
    }
    try {
      await p;
    } finally {
      threadCreationLocks.delete(lockKey);
    }
    thread = store.getByTelegram(botKey, chatId);
  }

  if (!thread) {
    const err = new Error("thread_create_failed");
    err.status = 500;
    throw err;
  }

  const normalizedText = String(text);
  let created;
  if (media?.fileId) {
    const downloaded = await downloadTelegramMedia(cfg.token, media);
    created = await cw.createMessageWithAttachment(thread.conversation_id, {
      content: normalizedText,
      ...downloaded,
    });
  } else {
    created = await cw.createMessage(thread.conversation_id, normalizedText);
  }
  const chatwootMessageId = extractChatwootMessageId(created);
  if (chatwootMessageId && telegramMessageId != null) {
    store.saveMessageLink({
      chatwoot_message_id: chatwootMessageId,
      bot_key: botKey,
      chat_id: chatId,
      telegram_message_id: telegramMessageId,
      conversation_id: thread.conversation_id,
    });
  }
  return { conversationId: thread.conversation_id };
}

async function drainOutboundQueueOnce() {
  const items = outboundQueue.list();
  if (!items.length) return;

  const next = [];
  for (const item of items) {
    const attempts = (item.attempts || 0) + 1;
    const token = item.token;
    const chatId = item.chat_id;
    const text = item.text;
    if (!token || chatId == null || !text) {
      continue;
    }
    try {
      await sendTelegramMessage(token, chatId, text);
    } catch (err) {
      console.warn("Telegram retry failed:", err.message);
      if (attempts >= TELEGRAM_SEND_MAX_ATTEMPTS) {
        console.error(
          "Telegram: отброшено после",
          TELEGRAM_SEND_MAX_ATTEMPTS,
          "попыток",
          item
        );
      } else {
        next.push({
          ...item,
          attempts,
          last_error: String(err.message || err),
        });
      }
    }
  }
  outboundQueue.replaceAll(next);
}

/** Одна цепочка промисов — без параллельных drain (иначе гонка по файлу очереди). */
let drainOutboundTail = Promise.resolve();
function scheduleDrainOutboundQueue() {
  drainOutboundTail = drainOutboundTail
    .then(() => drainOutboundQueueOnce())
    .catch((e) => console.error(e));
}

setInterval(() => {
  scheduleDrainOutboundQueue();
}, RETRY_INTERVAL_MS);

app.post("/telegram/incoming", requireSecret, async (req, res) => {
  try {
    const botsMap = getBots();
    const result = await processTelegramIncoming(req.body, botsMap);
    return res.json({ ok: true, conversationId: result.conversationId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return res.status(status).json({
      error: err.message || "internal_error",
    });
  }
});

app.get("/admin/bots", requireAdminSecret, (_req, res) => {
  try {
    const botsMap = getBots();
    return res.json({ bots: maskBots(botsMap) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.put("/admin/bots", requireAdminSecret, (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Нужен JSON-объект ботов" });
    }
    const partial = {};
    for (const [key, val] of Object.entries(body)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return res.status(400).json({ error: `Некорректный ключ: ${key}` });
      }
      if (!val || typeof val !== "object") {
        return res.status(400).json({ error: `Некорректное значение для ${key}` });
      }
      const inboxId = Number(val.inboxId);
      const token = val.token != null ? String(val.token).trim() : "";
      if (!Number.isFinite(inboxId) || inboxId < 1) {
        return res.status(400).json({ error: `inboxId для ${key}` });
      }
      if (!token) {
        return res.status(400).json({ error: `token для ${key}` });
      }
      partial[key] = { inboxId, token };
    }
    if (Object.keys(partial).length === 0) {
      return res.status(400).json({ error: "Пустой объект" });
    }
    mergeAndSaveRuntime(partial);
    return res.json({ ok: true, bots: maskBots(getBots()) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/admin/verify-telegram", requireAdminSecret, async (req, res) => {
  try {
    let token =
      req.body?.token != null ? String(req.body.token).trim() : "";
    const botKey = req.body?.botKey != null ? String(req.body.botKey).trim() : "";
    if (!token && botKey) {
      token = getBots()[botKey]?.token || "";
    }
    if (!token) {
      return res.status(400).json({
        error: "Нужен token или сохранённый botKey на мосту",
      });
    }
    const url = `https://api.telegram.org/bot${token}/getMe`;
    const { data } = await axios.get(url, { timeout: 15000 });
    return res.json(data);
  } catch (err) {
    const msg = err.response?.data || err.message;
    return res.status(502).json({ ok: false, error: msg });
  }
});

app.post("/admin/test-incoming", requireAdminSecret, async (req, res) => {
  try {
    const botKey = req.body?.botKey;
    const text =
      (req.body?.text && String(req.body.text)) ||
      "Проверка из портала поддержки";
    if (!botKey) {
      return res.status(400).json({ error: "Нужен botKey" });
    }
    const botsMap = getBots();
    const result = await processTelegramIncoming(
      {
        botKey,
        chatId: "portal_test",
        text,
        name: "Тест портала",
      },
      botsMap
    );
    return res.json({ ok: true, conversationId: result.conversationId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return res.status(status).json({ error: err.message || "internal_error" });
  }
});

app.post(
  "/chatwoot/webhook",
  (req, res, next) => {
    const ev = req.body?.event;
    const msg = req.body?.message || req.body;
    console.log("[chatwoot webhook]", ev, {
      cwMessageId: msg?.id ?? req.body?.id,
      softDeleted: isMessageSoftDeleted(msg),
    });
    next();
  },
  verifyChatwootWebhook,
  async (req, res) => {
    try {
      const event = req.body?.event;
      if (event === "conversation_created") {
        let notified = false;
        if (
          notifyChannelsConfigured() &&
          modeAllowsFirstMessage()
        ) {
          await notifyConversationCreated(req.body);
          notified = true;
        }
        return res
          .status(200)
          .json({ ok: true, conversation_notified: notified });
      }
      if (event === "conversation_updated") {
        if (
          modeAllowsOperator() &&
          notifyChannelsConfigured() &&
          conversationHasOperatorOrHandoff(
            req.body.conversation || req.body
          )
        ) {
          try {
            await notifyConversationCreated({
              ...req.body,
              notify_reason: "operator",
            });
            console.log("[new_conv_notify] via conversation_updated");
          } catch (e) {
            console.warn(
              "[new_conv_notify] conversation_updated failed:",
              e.message
            );
          }
        }
        return res.status(200).json({ ok: true });
      }
      if (
        event !== "message_created" &&
        event !== "message_deleted" &&
        event !== "message_updated"
      ) {
        return res.status(200).json({ ignored: true });
      }

      const message = req.body.message || req.body;
      const botsMap = getBots();

      const shouldSyncDelete =
        event === "message_deleted" ||
        (event === "message_updated" && isMessageSoftDeleted(message));

      if (shouldSyncDelete) {
        const chatwootMessageId = extractWebhookMessageId(req.body, message);
        if (!chatwootMessageId) {
          return res.status(200).json({ ok: false, error: "missing_message_id" });
        }
        try {
          const result = await syncDeleteMessageToTelegram(
            chatwootMessageId,
            botsMap
          );
          if (result.skipped) {
            console.log("[chatwoot webhook] delete skipped:", result.skipped);
          }
          return res.status(200).json(result);
        } catch (deleteErr) {
          console.warn("Telegram delete failed:", deleteErr.message);
          return res
            .status(200)
            .json({ ok: false, error: "telegram_delete_failed" });
        }
      }

      if (event !== "message_created") {
        return res.status(200).json({ ignored: true });
      }

      if (message.private === true || message.content_attributes?.private) {
        return res.status(200).json({ ignored: true });
      }

      if (!isOutgoingMessage(message) && notifyChannelsConfigured()) {
        const c = message.conversation;
        if (modeAllowsFirstMessage() && isFirstIncomingMessageInConversation(message)) {
          try {
            await notifyConversationCreated({
              event: "message_created",
              conversation: c,
              contact: message.sender || c?.meta?.sender,
            });
            console.log("[new_conv_notify] via message_created (first incoming)");
          } catch (e) {
            console.warn("[new_conv_notify] first incoming failed:", e.message);
          }
        } else if (
          modeAllowsOperator() &&
          c &&
          conversationHasOperatorOrHandoff(c)
        ) {
          try {
            await notifyConversationCreated({
              event: "message_created",
              conversation: c,
              contact: message.sender || c?.meta?.sender,
              notify_reason: "operator",
            });
            console.log(
              "[new_conv_notify] via message_created (incoming, operator/handoff)"
            );
          } catch (e) {
            console.warn(
              "[new_conv_notify] message_created operator path failed:",
              e.message
            );
          }
        }
      }

      const conversationId =
        message.conversation?.id ?? message.conversation_id ?? req.body.conversation?.id;
      if (conversationId == null) {
        return res.status(200).json({ ignored: true });
      }
      const thread = store.getByConversation(Number(conversationId));
      if (!thread) {
        return res.status(200).json({ unknownThread: true });
      }
      const cfg = botsMap[thread.bot_key];
      if (!cfg?.token) {
        console.warn("Нет token для bot_key", thread.bot_key);
        return res.status(200).json({ skipped: true });
      }

      if (!isOutgoingMessage(message)) {
        return res.status(200).json({ ignored: true });
      }

      const content = message.content;
      const attachments = Array.isArray(message.attachments)
        ? message.attachments
        : [];
      if ((!content && attachments.length === 0) || conversationId == null) {
        return res.status(200).json({ ignored: true });
      }
      const chatwootMessageId = Number(message.id);
      if (
        Number.isFinite(chatwootMessageId) &&
        store.getByChatwootMessageId(chatwootMessageId)
      ) {
        return res.status(200).json({ ignored: true, reason: "already_synced" });
      }

      try {
        let mediaSent = false;
        const sentTelegramMessageIds = [];
        for (const attachment of attachments) {
          const sentId = await sendTelegramMedia(
            cfg.token,
            thread.chat_id,
            attachment,
            content
          );
          if (sentId) {
            sentTelegramMessageIds.push(sentId);
            mediaSent = true;
          }
        }
        if (!mediaSent && content) {
          const sentId = await sendTelegramMessage(cfg.token, thread.chat_id, content);
          if (sentId) {
            sentTelegramMessageIds.push(sentId);
          }
        }
        if (Number.isFinite(chatwootMessageId)) {
          for (const telegramMessageId of sentTelegramMessageIds) {
            store.saveMessageLink({
              chatwoot_message_id: chatwootMessageId,
              bot_key: thread.bot_key,
              chat_id: thread.chat_id,
              telegram_message_id: telegramMessageId,
              conversation_id: Number(conversationId),
            });
          }
        }
      } catch (sendErr) {
        console.warn("Telegram send failed, в очередь:", sendErr.message);
        if (content) {
          outboundQueue.enqueue({
            token: cfg.token,
            chat_id: thread.chat_id,
            text: content,
          });
          // Сразу повторить, не ждать следующий тик setInterval (раньше было до 15 с).
          scheduleDrainOutboundQueue();
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`telegram-bridge слушает :${PORT}`);
  if (!API_TOKEN) {
    console.warn(
      "Внимание: CHATWOOT_API_ACCESS_TOKEN пуст — API не будет работать"
    );
  }
});
