#!/usr/bin/env bash
# First push to an empty GitHub repo. Configure git user.name / user.email first.
# Auth: GitHub PAT (https) or SSH (git@github.com:.../repo.git).
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
  echo "Nothing to commit (empty index)."
  exit 1
fi

git branch -M main
git commit -m "Initial import"

echo ""
echo "Pushing to origin (GitHub login or SSH required)..."
git push -u origin main
