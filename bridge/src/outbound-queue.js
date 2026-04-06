import fs from "fs";
import path from "path";

/**
 * Персистентная очередь исходящих в Telegram при временных сбоях API.
 */
export function openOutboundQueue(filePath) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  function load() {
    try {
      const raw = fs.readFileSync(resolved, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data?.items) ? data.items : [];
    } catch {
      return [];
    }
  }

  function save(items) {
    fs.writeFileSync(resolved, JSON.stringify({ items }, null, 0), "utf8");
  }

  function enqueue(row) {
    const items = load();
    items.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      attempts: 0,
      created_at: new Date().toISOString(),
      ...row,
    });
    save(items);
  }

  function list() {
    return load();
  }

  function replaceAll(items) {
    save(items);
  }

  return { enqueue, list, replaceAll };
}
