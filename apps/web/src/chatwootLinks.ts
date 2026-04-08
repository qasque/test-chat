import {
  getChatwootAccountId,
  getChatwootNotesUrlOverride,
  getChatwootUrl,
} from "./config";

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
    notesHint: notes,
  };
}
