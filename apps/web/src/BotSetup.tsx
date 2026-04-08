import { useCallback, useEffect, useState } from "react";
import { getBridgeApiUrl } from "./config";
import "./BotSetup.css";

const STORAGE_SECRET = "portal.bridgeSecret";

/** Parse JSON; reject HTML error pages (nginx 502/404) so we do not call r.json() on HTML. */
async function readBridgeJson(r: Response): Promise<unknown> {
  const text = await r.text();
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) {
    const hint =
      r.status === 502 || r.status === 503 || r.status === 504
        ? " Сервис моста недоступен (502/503/504) — подождите и выполните: docker compose up -d telegram-bridge."
        : t.startsWith("<html") || t.startsWith("<!DOCTYPE")
          ? " Пришла HTML-страница вместо API (прокси или SPA). Проверьте, что портал открыт как http://127.0.0.1:18080 и контейнер telegram-bridge запущен."
          : "";
    throw new Error(
      `Ответ не JSON (HTTP ${r.status}).${hint}`
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Ответ не JSON (HTTP ${r.status}).`);
  }
}

type BotRow = {
  inboxId?: number;
  tokenMasked?: string;
  hasToken?: boolean;
};

export default function BotSetup() {
  const [bridgeSecret, setBridgeSecret] = useState("");
  const [botKey, setBotKey] = useState("test_bot");
  const [inboxId, setInboxId] = useState("");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedRow, setLoadedRow] = useState<BotRow | null>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(STORAGE_SECRET);
      if (s) setBridgeSecret(s);
    } catch {
      /* ignore */
    }
  }, []);

  const headers = useCallback(
    (json = true) => {
      const h: Record<string, string> = {};
      if (json) h["Content-Type"] = "application/json";
      if (bridgeSecret.trim()) h["X-Bridge-Secret"] = bridgeSecret.trim();
      return h;
    },
    [bridgeSecret]
  );

  const persistSecret = () => {
    try {
      if (bridgeSecret.trim()) {
        sessionStorage.setItem(STORAGE_SECRET, bridgeSecret.trim());
      } else {
        sessionStorage.removeItem(STORAGE_SECRET);
      }
    } catch {
      /* ignore */
    }
  };

  const loadBots = useCallback(async () => {
    setErr(null);
    setMsg(null);
    if (!bridgeSecret.trim()) {
      setErr("Введите секрет моста (BRIDGE_SECRET из .env)");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(getBridgeApiUrl("/admin/bots"), {
        headers: headers(false),
      });
      const j = (await readBridgeJson(r)) as {
        bots?: Record<string, BotRow>;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error || r.statusText);
      const row = j.bots?.[botKey];
      setLoadedRow(row || null);
      if (row?.inboxId != null) setInboxId(String(row.inboxId));
      setMsg("Настройки загружены.");
      persistSecret();
    } catch (e) {
      setLoadedRow(null);
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  }, [bridgeSecret, botKey, headers]);

  const saveBots = async () => {
    setErr(null);
    setMsg(null);
    if (!bridgeSecret.trim()) {
      setErr("Нужен BRIDGE_SECRET");
      return;
    }
    const inbox = Number(inboxId);
    if (!Number.isFinite(inbox) || inbox < 1) {
      setErr("Укажите корректный inbox ID (число из Chatwoot)");
      return;
    }
    if (!token.trim()) {
      setErr("Введите токен бота от BotFather");
      return;
    }
    setBusy(true);
    try {
      const body = { [botKey]: { inboxId: inbox, token: token.trim() } };
      const r = await fetch(getBridgeApiUrl("/admin/bots"), {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(body),
      });
      const j = (await readBridgeJson(r)) as { error?: string };
      if (!r.ok) throw new Error(j.error || r.statusText);
      setMsg("Сохранено на мосту (runtime-файл). Можно проверять токен и тест.");
      setToken("");
      persistSecret();
      await loadBots();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const verifyTelegram = async () => {
    setErr(null);
    setMsg(null);
    if (!bridgeSecret.trim()) {
      setErr("Нужен BRIDGE_SECRET");
      return;
    }
    const t = token.trim();
    setBusy(true);
    try {
      const r = await fetch(getBridgeApiUrl("/admin/verify-telegram"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(
          t ? { token: t } : { botKey }
        ),
      });
      const j = (await readBridgeJson(r)) as {
        ok?: boolean;
        result?: { username?: string; id?: number };
        error?: unknown;
      };
      if (!r.ok) throw new Error(JSON.stringify(j.error || j));
      setMsg(
        `Telegram OK: @${j.result?.username ?? "?"} (id ${j.result?.id ?? "—"})`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка verify");
    } finally {
      setBusy(false);
    }
  };

  const testIncoming = async () => {
    setErr(null);
    setMsg(null);
    if (!bridgeSecret.trim()) {
      setErr("Нужен BRIDGE_SECRET");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(getBridgeApiUrl("/admin/test-incoming"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          botKey,
          text: "Проверка из портала поддержки",
        }),
      });
      const j = (await readBridgeJson(r)) as {
        ok?: boolean;
        conversationId?: number;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error || r.statusText);
      setMsg(
        `Сообщение ушло в Chatwoot. conversationId=${j.conversationId ?? "—"}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка теста");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card bot-setup">
      <h2>Настройка Telegram-бота</h2>
      <p className="muted small">
        Секрет моста — значение <code>BRIDGE_SECRET</code> из <code>.env</code>.
        Нужен также <code>CHATWOOT_API_ACCESS_TOKEN</code> в .env на сервере.
      </p>

      <div className="field">
        <label htmlFor="bridgeSecret">BRIDGE_SECRET</label>
        <input
          id="bridgeSecret"
          type="password"
          autoComplete="off"
          value={bridgeSecret}
          onChange={(e) => setBridgeSecret(e.target.value)}
          placeholder="Секрет из .env"
        />
      </div>

      <div className="field">
        <label htmlFor="botKey">Ключ бота (botKey)</label>
        <input
          id="botKey"
          value={botKey}
          onChange={(e) => setBotKey(e.target.value)}
          placeholder="test_bot"
        />
      </div>

      <div className="field">
        <label htmlFor="inboxId">Inbox ID (Chatwoot)</label>
        <input
          id="inboxId"
          inputMode="numeric"
          value={inboxId}
          onChange={(e) => setInboxId(e.target.value)}
          placeholder="2"
        />
      </div>

      <div className="field">
        <label htmlFor="token">Токен BotFather</label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="123456789:AA..."
        />
        {loadedRow?.hasToken && (
          <p className="muted small">
            В мосту уже есть токен (маска: {loadedRow.tokenMasked}). Введите
            новый, чтобы заменить.
          </p>
        )}
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => loadBots()}
        >
          Загрузить с моста
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => saveBots()}
        >
          Сохранить на мост
        </button>
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => verifyTelegram()}
        >
          Проверить токен в Telegram
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => testIncoming()}
        >
          Тест: сообщение в Chatwoot
        </button>
      </div>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}
    </section>
  );
}
