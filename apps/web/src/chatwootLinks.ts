import {
  getChatwootAccountId,
  getChatwootNotesUrlOverride,
  getChatwootUrl,
} from "./config";

/** Пути как в chatwoot: conversation.routes.js, canned.routes.js */
export function getChatwootAppLinks() {
  const base = getChatwootUrl();
  const id = getChatwootAccountId();
  const app = `${base}/app/accounts/${id}`;
  const notes =
    getChatwootNotesUrlOverride() ?? `${app}/dashboard`;
  return {
    dashboard: `${app}/dashboard`,
    mentions: `${app}/mentions/conversations`,
    unattended: `${app}/unattended/conversations`,
    cannedResponses: `${app}/settings/canned-response/list`,
    /** Заметки: по умолчанию инбокс; можно задать VITE_CHATWOOT_NOTES_URL или кастомный путь в config.js */
    notesHint: notes,
  };
}
