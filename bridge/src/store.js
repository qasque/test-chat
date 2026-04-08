import fs from "fs";
import path from "path";

export function openStore(filePath) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  function load() {
    try {
      const raw = fs.readFileSync(resolved, "utf8");
      const data = JSON.parse(raw);
      const threads =
        data?.threads && typeof data.threads === "object" ? data.threads : {};
      const messageLinks =
        data?.message_links && typeof data.message_links === "object"
          ? data.message_links
          : {};
      return { threads, messageLinks };
    } catch {
      return { threads: {}, messageLinks: {} };
    }
  }

  function save(payload) {
    fs.writeFileSync(
      resolved,
      JSON.stringify(
        {
          threads: payload.threads || {},
          message_links: payload.messageLinks || {},
        },
        null,
        0
      ),
      "utf8"
    );
  }

  function key(botKey, chatId) {
    return `${botKey}::${String(chatId)}`;
  }

  return {
    getByTelegram(botKey, chatId) {
      const { threads } = load();
      const row = threads[key(botKey, chatId)];
      return row || null;
    },
    getByConversation(conversationId) {
      const { threads } = load();
      const id = Number(conversationId);
      for (const k of Object.keys(threads)) {
        if (Number(threads[k].conversation_id) === id) {
          const [botKey, chatId] = k.split("::");
          return {
            bot_key: botKey,
            chat_id: chatId,
            conversation_id: threads[k].conversation_id,
            contact_id: threads[k].contact_id,
          };
        }
      }
      return null;
    },
    saveThread(row) {
      const payload = load();
      const threads = payload.threads;
      threads[key(row.bot_key, row.chat_id)] = {
        conversation_id: row.conversation_id,
        contact_id: row.contact_id,
        updated_at: new Date().toISOString(),
      };
      save(payload);
    },
    saveMessageLink({
      chatwoot_message_id,
      bot_key,
      chat_id,
      telegram_message_id,
      conversation_id,
    }) {
      const payload = load();
      const messageLinks = payload.messageLinks;
      const now = new Date().toISOString();
      const cwId = Number(chatwoot_message_id);
      const tgId = Number(telegram_message_id);
      if (!Number.isFinite(cwId) || !Number.isFinite(tgId)) return;
      const byCwKey = `cw::${cwId}`;
      const byTgKey = `tg::${bot_key}::${String(chat_id)}::${tgId}`;
      const row = {
        chatwoot_message_id: cwId,
        bot_key,
        chat_id: String(chat_id),
        telegram_message_id: tgId,
        conversation_id: Number(conversation_id) || undefined,
        updated_at: now,
      };
      messageLinks[byCwKey] = row;
      messageLinks[byTgKey] = row;
      save(payload);
    },
    getByChatwootMessageId(chatwootMessageId) {
      const { messageLinks } = load();
      const id = Number(chatwootMessageId);
      if (!Number.isFinite(id)) return null;
      return messageLinks[`cw::${id}`] || null;
    },
    deleteByChatwootMessageId(chatwootMessageId) {
      const payload = load();
      const messageLinks = payload.messageLinks;
      const id = Number(chatwootMessageId);
      if (!Number.isFinite(id)) return;
      const byCwKey = `cw::${id}`;
      const row = messageLinks[byCwKey];
      if (!row) return;
      const byTgKey = `tg::${row.bot_key}::${String(row.chat_id)}::${Number(
        row.telegram_message_id
      )}`;
      delete messageLinks[byCwKey];
      delete messageLinks[byTgKey];
      save(payload);
    },
  };
}
