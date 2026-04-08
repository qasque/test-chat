#!/usr/bin/env sh
# Run from your Chatwoot fork clone (not this infra repo). See docs/fork-workflow.md.
set -e
UPSTREAM_BRANCH="${1:-develop}"
git fetch upstream
git merge "upstream/$UPSTREAM_BRANCH"
echo "Resolve conflicts if any, then: git push origin"
