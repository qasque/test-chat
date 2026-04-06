FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Без внешнего .sh (на Windows CRLF ломает exec в Linux-образе)
CMD /bin/sh -c 'printf "window.__APP_CONFIG__={CHATWOOT_URL:\"%s\"};\n" "${FRONTEND_URL:-http://127.0.0.1:3000}" > /usr/share/nginx/html/config.js && exec nginx -g "daemon off;"'
