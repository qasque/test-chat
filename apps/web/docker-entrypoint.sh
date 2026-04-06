#!/bin/sh
set -e
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3000}"
cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__={CHATWOOT_URL:"$FRONTEND_URL"};
EOF
exec nginx -g "daemon off;"
