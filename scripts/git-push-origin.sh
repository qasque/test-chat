#!/usr/bin/env bash
# Первый push в пустой репозиторий GitHub (Debian/Ubuntu/macOS).
# Перед запуском: установите git, настройте git config user.name / user.email.
# Аутентификация GitHub: PAT (https) или ssh-ключ (url вида git@github.com:.../test-chat.git).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE_URL="${1:-https://github.com/qasque/test-chat.git}"

if [[ ! -d "$ROOT/.git" ]]; then
  git init
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"

git add -A
git status

if git diff --cached --quiet; then
  echo "Нечего коммитить (пустой индекс)."
  exit 1
fi

git branch -M main
git commit -m "Initial import"

echo ""
echo "Отправка в origin (потребуется логин GitHub или SSH)..."
git push -u origin main
