#!/usr/bin/env sh
# git pull в ./chatwoot + пересборка образов rails и sidekiq + перезапуск.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f chatwoot/docker/Dockerfile ]; then
  echo "Нет chatwoot/docker/Dockerfile. Сначала: ./scripts/clone-chatwoot.sh"
  exit 1
fi

if [ ! -d chatwoot/.git ]; then
  echo "Ошибка: chatwoot/.git не найден — это не git-клон?"
  exit 1
fi

echo ">>> git pull в chatwoot"
git -C chatwoot pull

echo ">>> docker compose build rails sidekiq"
docker compose build rails sidekiq

echo ">>> docker compose up -d rails sidekiq"
docker compose up -d rails sidekiq

echo "Готово. Обновлённый фронт в образе qasque-chatwoot:local."
