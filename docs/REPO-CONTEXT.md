# Контекст репозитория (для продолжения работы в новом чате)

Краткая записка о том, что это за монорепозиторий и где что лежит. Файл **намеренно в git** (см. исключение в `.gitignore`), чтобы ассистент или человек могли быстро войти в контекст после сброса памяти чата.

## Что внутри

| Часть | Назначение |
|--------|------------|
| **Chatwoot (форк)** | **`docker-compose.yml`** собирает **`rails` / `sidekiq`** из **`chatwoot/`** (клон **`qasque/chatwoot-custom`**, ветка **`develop`** — не `main`). См. **`docs/CHATWOOT-SOURCE.txt`**. Скрипты: **`clone-chatwoot.sh`**, **`update-chatwoot-stack.sh`**. GHCR без локальной сборки: **`image: ghcr.io/qasque/chatwoot-custom:develop`**. **Звук после ИИ-handoff:** `patches/chatwoot/ai-handoff-audio-gate.diff`, `apply-chatwoot-ai-handoff-audio-patch.ps1`, `build-chatwoot-image.ps1`. Откат: `DISABLE_AI_HANDOFF_AUDIO_GATE=true`. |
| **telegram-bridge** | `bridge/` — вход из Telegram в Chatwoot, вебхук Chatwoot → обратно в Telegram, мобильный gateway (`mobile-gateway`). Порт по умолчанию **4000**. |
| **ai-bot** | `ai-bot/` — вебхук Chatwoot → OpenClaw (`/v1/chat/completions`), ответ в диалог через Chatwoot API. Порт **5005**. |
| **Веб-портал** | `apps/web/` — сервис `portal` в compose, прокси к bridge. **Операторский минимум:** `PORTAL_UI_MODE=operator` в `.env` — только встроенный Chatwoot (вход + диалоги), без вкладок «Статус / Настройка / Ещё». Локально: `VITE_PORTAL_UI_MODE=operator`. Памятка по форку Chatwoot и Flutter: `patches/chatwoot/operator-minimal-ui.txt`. |
| **Desktop** | `apps/desktop/` — отдельное приложение. |
| **Мобильные приложения** | Исходники **не** в этом репо. Рабочие Flutter-приложения: **`https://github.com/qasque/android-chat`** и **`https://github.com/qasque/ios-chat`** (ветка `main` совпадает по коду). Вход оператора: **email + пароль Chatwoot** через мост `POST …/mobile/v1/auth/login` (в приложении — экран «Оператор» / `AgentWorkspaceController.loginWithBridge`). На сервере нужен **`BRIDGE_MOBILE_JWT_SECRET`**. Меню оператора там же сокращать до входа и работы с диалогами (см. `patches/chatwoot/operator-minimal-ui.txt`). |
| **Демо-бот** | `telegram-demo-bot/` — профиль `demo` в compose. |
| **Примеры** | `examples/`, `deploy/`. |

## Git remotes

- **`origin`** → `https://github.com/qasque/test-chat.git` — основной монорепозиторий (стек + приложения).
- **`android-chat`** / **`ios-chat`** → **основные** репозитории мобильного клиента (Flutter); в `test-chat` только remotes для `git fetch`.

## Важные пути и данные

- Секреты только в **`.env`** (в git не коммитится); шаблон — **`.env.example`**.
- Состояние моста: volume **`bridge_data`** (маппинги диалогов, очередь исходящих в Telegram).
- В **`.gitignore`**: `_android_chat_tmp/`, `_ios_chat_tmp/` — локальные копии других репо, не коммитить.

## Типичный поток сообщений

1. Пользователь пишет в **Telegram** → bridge создаёт/обновляет контакт и **incoming** в Chatwoot.  
2. **Chatwoot** шлёт вебхук в **ai-bot** (если настроен URL вебхука на `ai-bot`).  
3. **ai-bot** дергает **OpenClaw** и постит **outgoing** в тот же диалог.  
4. **Chatwoot** шлёт вебхук **`message_created`** на **telegram-bridge** `/chatwoot/webhook` → bridge шлёт текст в Telegram. Задержки/очередь исходящих — логика в `bridge/src/server.js` (очередь на диске, повторы).

Уведомление о новом диалоге: **`conversation_created`** и/или первое входящее **`message_created`** (если в payload есть `messages_count === 1`) — переменные `BRIDGE_NEW_CONV_*` в `.env.example`.

## Коммиты без trailer IDE

Глобальные хуки могут дописывать строки вроде `Made-with: Cursor`. В репозитории есть пустая папка хуков и подсказка в `scripts/git-msg-strip-cursor-trailer.py`:

```bash
git -c core.hooksPath=scripts/empty_git_hooks commit ...
```

## Markdown в git

Правило в `.gitignore`: по умолчанию игнорируются все **`*.md`**, кроме явных исключений. Сейчас в индекс допускаются **`docs/REPO-CONTEXT.md`**, **`docs/CURSOR-AGENTS-CHAT-INDEX.md`** и **`docs/PRIVATE-REPO-SYNC.md`** (план работы с приватным remote) — при добавлении других `.md` в репозиторий добавьте для них строки `!...` в `.gitignore`.

## Разработка мобильного клиента

Клонировать **`android-chat`** или **`ios-chat`**, собирать там (`flutter run` / Xcode / Android Studio). Прод-сборка: задать **`BRIDGE_BASE_URL`** (часто `https://…/api/bridge` через портал) и при необходимости `--dart-define` из `lib/src/config/app_config.dart`.

---

*Обновляйте этот файл при смене архитектуры, remotes или имён сервисов в compose.*
