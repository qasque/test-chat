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

echo ">>> git: ветка develop + pull в chatwoot"
git -C chatwoot fetch origin
git -C chatwoot checkout develop
git -C chatwoot pull origin develop

# Подряд, не параллельно: иначе два раза гоняется precompile (OOM / «зависание» на шаге Vite).
echo ">>> docker compose build rails (шаг assets:precompile + Vite — на VPS часто 15–45+ мин)"
docker compose build rails
echo ">>> docker compose build sidekiq"
docker compose build sidekiq

echo ">>> docker compose up -d rails sidekiq"
docker compose up -d rails sidekiq

echo "Готово. Обновлённый фронт в образе qasque-chatwoot:local."
