/**
 * Example: forward a Telegram message to the bridge after your bot handles it.
 * Env: BRIDGE_URL, BRIDGE_SECRET, BOT_KEY (matches TELEGRAM_BOTS_JSON).
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
