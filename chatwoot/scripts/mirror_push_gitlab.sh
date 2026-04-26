#!/usr/bin/env bash
# Push every branch and tag to a GitLab remote (same as "gitlab" if you added it already).
# GitLab project should be empty on first run; use SSH or HTTPS with a PAT (write_repository).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE_NAME="${GITLAB_REMOTE_NAME:-gitlab}"
URL="${GITLAB_REMOTE_URL:-${1:-}}"

if [[ -z "$URL" ]] && ! git remote get-url "$REMOTE_NAME" &>/dev/null; then
  echo "Usage: $0 <gitlab-clone-url>" >&2
  echo "   or: GITLAB_REMOTE_URL=... $0" >&2
  echo "   or: git remote add $REMOTE_NAME <url>  then $0" >&2
  exit 1
fi

if [[ -n "${URL}" ]]; then
  if git remote get-url "$REMOTE_NAME" &>/dev/null; then
    git remote set-url "$REMOTE_NAME" "$URL"
  else
    git remote add "$REMOTE_NAME" "$URL"
  fi
fi

git fetch origin --prune 2>/dev/null || true

git push "$REMOTE_NAME" --all --prune
git push "$REMOTE_NAME" --tags --prune

echo "Pushed branches and tags to $REMOTE_NAME."
