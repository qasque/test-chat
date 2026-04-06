const fs = require("fs");
const path = require("path");

const webDist = path.join(__dirname, "..", "..", "web", "dist");
const desktopDist = path.join(__dirname, "..", "dist");

if (!fs.existsSync(webDist)) {
  console.error("Нет apps/web/dist. Выполните: cd apps/web && npm run build");
  process.exit(1);
}

fs.rmSync(desktopDist, { recursive: true, force: true });
fs.cpSync(webDist, desktopDist, { recursive: true });
console.log("Скопировано web/dist -> apps/desktop/dist");
