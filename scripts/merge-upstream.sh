#!/usr/bin/env sh
# Используйте в клоне форка Chatwoot (не в этом репозитории инфраструктуры).
# Положите скрипт в корень клона chatwoot или скопируйте команды из docs/fork-workflow.md
set -e
UPSTREAM_BRANCH="${1:-develop}"
git fetch upstream
git merge "upstream/$UPSTREAM_BRANCH"
echo "Разрешите конфликты при необходимости, затем: git push origin"
