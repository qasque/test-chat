import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import os from "os";
import path from "path";
import { openStore } from "../src/store.js";

test("store: save and get by telegram and conversation", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-store-"));
  const db = path.join(dir, "t.json");
  const store = openStore(db);

  assert.strictEqual(store.getByTelegram("a", "1"), null);
  store.saveThread({
    bot_key: "a",
    chat_id: "1",
    conversation_id: 42,
    contact_id: 7,
  });
  const t1 = store.getByTelegram("a", "1");
  assert.strictEqual(t1.conversation_id, 42);
  const t2 = store.getByConversation(42);
  assert.strictEqual(t2.bot_key, "a");
  assert.strictEqual(String(t2.chat_id), "1");
});
