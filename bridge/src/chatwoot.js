import axios from "axios";
import FormData from "form-data";

export function createChatwootClient({ baseUrl, apiAccessToken, accountId }) {
  const api = axios.create({
    baseURL: `${baseUrl.replace(/\/$/, "")}/api/v1`,
    headers: {
      api_access_token: apiAccessToken,
    },
    timeout: 30000,
  });

  api.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err.response?.status;
      const data = err.response?.data;
      const detail =
        typeof data === "string"
          ? data.slice(0, 500)
          : data?.error || data?.message || JSON.stringify(data || {});
      let hint = "";
      if (status === 401 || status === 403) {
        hint =
          " Укажите в .env именно CHATWOOT_API_ACCESS_TOKEN из Chatwoot: Профиль → Access Token (не Webhook Secret и не BRIDGE_SECRET).";
      }
      const e = new Error(`Chatwoot API ${status ?? "?"}: ${detail}.${hint}`);
      e.status = status >= 500 ? 502 : 400;
      return Promise.reject(e);
    }
  );

  const accountPath = `/accounts/${accountId}`;

  async function searchContactByIdentifier(identifier) {
    const { data } = await api.get(`${accountPath}/contacts/search`, {
      params: { q: identifier },
    });
    const payload = data?.payload;
    if (!payload?.length) return null;
    return payload[0];
  }

  async function createContact({ inboxId, name, identifier }) {
    const { data } = await api.post(`${accountPath}/contacts`, {
      inbox_id: inboxId,
      name: name || identifier,
      identifier,
      source_id: identifier,
    });
    const contact =
      data?.payload?.contact || data?.payload || data?.contact || data;
    if (!contact?.id) {
      throw new Error("Chatwoot: не удалось создать контакт");
    }
    return contact;
  }

  async function getOrCreateContact({ inboxId, name, identifier }) {
    const existing = await searchContactByIdentifier(identifier);
    if (existing?.id) {
      return existing;
    }
    return createContact({ inboxId, name, identifier });
  }

  async function createConversation({ inboxId, contactId, sourceId }) {
    const { data } = await api.post(`${accountPath}/conversations`, {
      source_id: sourceId,
      inbox_id: inboxId,
      contact_id: contactId,
      status: "open",
    });
    const conv = data?.payload || data;
    if (!conv?.id) {
      throw new Error("Chatwoot: не удалось создать диалог");
    }
    return conv;
  }

  async function listContactConversations(contactId) {
    const { data } = await api.get(
      `${accountPath}/contacts/${contactId}/conversations`
    );
    return data?.payload || [];
  }

  async function createMessage(conversationId, content) {
    const { data } = await api.post(
      `${accountPath}/conversations/${conversationId}/messages`,
      {
        content,
        message_type: "incoming",
        private: false,
      }
    );
    return data;
  }

  async function createMessageWithAttachment(conversationId, payload) {
    const form = new FormData();
    form.append("message_type", "incoming");
    form.append("private", "false");
    form.append("content", payload?.content || "");
    form.append(
      "attachments[]",
      payload.buffer,
      payload.fileName || "attachment.bin"
    );
    const { data } = await api.post(
      `${accountPath}/conversations/${conversationId}/messages`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    return data;
  }

  return {
    getOrCreateContact,
    createConversation,
    listContactConversations,
    createMessage,
    createMessageWithAttachment,
  };
}
