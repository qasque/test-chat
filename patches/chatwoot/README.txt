Патчи к исходникам форка Chatwoot (отдельный репозиторий), не к test-chat.

ai-handoff-audio-gate.diff — звук в дашборде только после custom_attributes.ai_handoff (как в ai-bot).

Применение (Windows, из корня test-chat):
  .\scripts\apply-chatwoot-ai-handoff-audio-patch.ps1 -ChatwootRoot "C:\path\to\chatwoot-custom"

Linux/macOS:
  cd /path/to/chatwoot-custom && git apply /path/to/test-chat/patches/chatwoot/ai-handoff-audio-gate.diff

Откат гейта в .env Rails: DISABLE_AI_HANDOFF_AUDIO_GATE=true
