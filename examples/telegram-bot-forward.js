/**
 * Пример: после обработки сообщения в Telegram-боте отправить его в мост.
 * Установите: npm install node-fetch (или используйте глобальный fetch в Node 18+).
 *
 * Переменные окружения:
 *   BRIDGE_URL — https://your-domain или http://127.0.0.1:4000
 *   BRIDGE_SECRET — как BRIDGE_SECRET в .env моста
 *   BOT_KEY — ключ из TELEGRAM_BOTS_JSON (например payments_bot)
 */

export async function forwardToBridge({ text, chatId, userId, username, name }) {
  const base = process.env.BRIDGE_URL || "http://127.0.0.1:4000";
  const secret = process.env.BRIDGE_SECRET || "";
  const botKey = process.env.BOT_KEY || "demo_bot";

  const res = await fetch(`${base.replace(/\/$/, "")}/telegram/incoming`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Bridge-Secret": secret } : {}),
    },
    body: JSON.stringify({
      botKey,
      chatId,
      userId,
      username,
      name,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`bridge ${res.status}: ${err}`);
  }
  return res.json();
}
