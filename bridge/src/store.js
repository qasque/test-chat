import fs from "fs";
import path from "path";

/**
 * Простое персистентное хранилище соответствий без нативных модулей.
 * Формат файла: { threads: { "botKey::chatId": { conversation_id, contact_id, ... } } }
 */
export function openStore(filePath) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  function load() {
    try {
      const raw = fs.readFileSync(resolved, "utf8");
      const data = JSON.parse(raw);
      return data?.threads && typeof data.threads === "object"
        ? data.threads
        : {};
    } catch {
      return {};
    }
  }

  function save(threads) {
    fs.writeFileSync(
      resolved,
      JSON.stringify({ threads }, null, 0),
      "utf8"
    );
  }

  function key(botKey, chatId) {
    return `${botKey}::${String(chatId)}`;
  }

  return {
    getByTelegram(botKey, chatId) {
      const threads = load();
      const row = threads[key(botKey, chatId)];
      return row || null;
    },
    getByConversation(conversationId) {
      const threads = load();
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
      const threads = load();
      threads[key(row.bot_key, row.chat_id)] = {
        conversation_id: row.conversation_id,
        contact_id: row.contact_id,
        updated_at: new Date().toISOString(),
      };
      save(threads);
    },
  };
}
