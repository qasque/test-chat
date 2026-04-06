import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import os from "os";
import path from "path";
import { openOutboundQueue } from "../src/outbound-queue.js";

test("outbound queue: enqueue drains on success path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-q-"));
  const qpath = path.join(dir, "q.json");
  const q = openOutboundQueue(qpath);
  assert.strictEqual(q.list().length, 0);
  q.enqueue({ token: "x", chat_id: 1, text: "hi" });
  assert.strictEqual(q.list().length, 1);
  q.replaceAll([]);
  assert.strictEqual(q.list().length, 0);
});
