import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Telegraf } from "telegraf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bridgeUrl = (process.env.BRIDGE_URL || "http://127.0.0.1:4000").replace(
  /\/$/,
  ""
);
const botKey = process.env.TELEGRAM_BOT_KEY || "demo_bot";
const secret = process.env.BRIDGE_SECRET || "";

if (!token) {
  console.error(
    "Задайте TELEGRAM_BOT_TOKEN в .env (тот же токен должен быть в TELEGRAM_BOTS_JSON для этого botKey)."
  );
  process.exit(1);
}

const bot = new Telegraf(token);

async function forwardToBridge(ctx, text) {
  const chatId = ctx.chat?.id;
  const user = ctx.from;
  if (chatId == null || !text) return;

  const headers = { "Content-Type": "application/json" };
  if (secret) headers["X-Bridge-Secret"] = secret;

  const body = {
    botKey,
    chatId: chatId != null ? String(chatId) : chatId,
    userId: user?.id != null ? String(user.id) : undefined,
    username: user?.username,
    name:
      [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
      undefined,
    text,
  };

  const res = await fetch(`${bridgeUrl}/telegram/incoming`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`bridge ${res.status}: ${errText}`);
  }
}

bot.start(async (ctx) => {
  await ctx.reply(
    "Привет! Напишите сообщение — оно уйдёт операторам в Chatwoot. Ответ придёт сюда же."
  );
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  try {
    await forwardToBridge(ctx, text);
  } catch (e) {
    console.error(e);
    await ctx.reply(
      "Не удалось отправить сообщение в поддержку. Проверьте мост и TELEGRAM_BOTS_JSON."
    );
  }
});

bot.catch((err) => console.error("telegraf", err));

bot.launch().then(() => {
  console.log(`Демо-бот запущен, botKey=${botKey}, bridge=${bridgeUrl}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
