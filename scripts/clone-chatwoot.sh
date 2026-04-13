#!/usr/bin/env sh
# Клон форка Chatwoot в ./chatwoot (из корня test-chat).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
URL="${CHATWOOT_GIT_URL:-https://github.com/qasque/chatwoot-custom.git}"

if [ -f chatwoot/docker/Dockerfile ]; then
  echo "chatwoot/docker/Dockerfile уже есть. Для обновления: ./scripts/update-chatwoot-stack.sh или cd chatwoot && git pull"
  exit 0
fi

if [ -d chatwoot ] && [ -n "$(ls -A chatwoot 2>/dev/null)" ]; then
  echo "Ошибка: папка chatwoot не пуста. Удалите или переименуйте: $ROOT/chatwoot"
  exit 1
fi

rm -rf chatwoot
git clone "$URL" chatwoot

if [ ! -f chatwoot/docker/Dockerfile ]; then
  echo "Ошибка: после клона нет chatwoot/docker/Dockerfile"
  exit 1
fi

echo "Готово: $ROOT/chatwoot"
echo "Далее: docker compose build rails sidekiq && docker compose up -d"
