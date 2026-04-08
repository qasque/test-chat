import { useCallback, useEffect, useState } from "react";
import { getBridgeHealthUrl, getAiBotHealthUrl } from "./config";

type BridgeHealth = {
  ok?: boolean;
  service?: string;
  outboundQueueSize?: number;
};

type AiBotHealth = {
  status?: string;
  openclaw_reachable?: boolean;
  openclaw_chat_api?: boolean;
  bot_token_set?: boolean;
  openclaw_url?: string;
};

function Indicator({ ok }: { ok: boolean | undefined }) {
  if (ok === undefined) return <span className="indicator unknown">—</span>;
  return ok ? (
    <span className="indicator ok">OK</span>
  ) : (
    <span className="indicator fail">ERR</span>
  );
}

export default function StatusTab() {
  const [bridge, setBridge] = useState<BridgeHealth | null>(null);
  const [bridgeErr, setBridgeErr] = useState<string | null>(null);
  const [aiBot, setAiBot] = useState<AiBotHealth | null>(null);
  const [aiBotErr, setAiBotErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setBridgeErr(null);
    setAiBotErr(null);

    const fetchBridge = fetch(getBridgeHealthUrl(), { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setBridge((await r.json()) as BridgeHealth);
      })
      .catch((e) => {
        setBridge(null);
        setBridgeErr(e instanceof Error ? e.message : "Ошибка");
      });

    const fetchAi = fetch(getAiBotHealthUrl(), { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setAiBot((await r.json()) as AiBotHealth);
      })
      .catch((e) => {
        setAiBot(null);
        setAiBotErr(e instanceof Error ? e.message : "Ошибка");
      });

    await Promise.allSettled([fetchBridge, fetchAi]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="status-tab">
      <section className="card">
        <h2>Telegram Bridge</h2>
        {loading && !bridge && !bridgeErr && (
          <p className="muted">Загрузка…</p>
        )}
        {bridgeErr && (
          <p className="error">
            Недоступно: {bridgeErr}
            <br />
            <span className="muted small">
              Убедитесь, что сервис telegram-bridge запущен (порт 4000).
            </span>
          </p>
        )}
        {bridge?.ok && (
          <ul className="list">
            <li>
              <strong>Сервис:</strong> {bridge.service ?? "—"}
            </li>
            <li>
              <strong>Очередь исходящих:</strong>{" "}
              {bridge.outboundQueueSize ?? 0}
            </li>
          </ul>
        )}
        {bridge?.ok !== undefined && (
          <p>
            Статус: <Indicator ok={bridge?.ok} />
          </p>
        )}
      </section>

      <section className="card">
        <h2>AI-бот (OpenClaw)</h2>
        {loading && !aiBot && !aiBotErr && (
          <p className="muted">Загрузка…</p>
        )}
        {aiBotErr && (
          <p className="error">
            Недоступно: {aiBotErr}
            <br />
            <span className="muted small">
              Убедитесь, что контейнер ai-bot запущен (порт 5005).
            </span>
          </p>
        )}
        {aiBot && (
          <ul className="list">
            <li>
              <strong>OpenClaw доступен:</strong>{" "}
              <Indicator ok={aiBot.openclaw_reachable} />
            </li>
            <li>
              <strong>Chat API:</strong>{" "}
              <Indicator ok={aiBot.openclaw_chat_api} />
            </li>
            <li>
              <strong>Токен бота:</strong>{" "}
              <Indicator ok={aiBot.bot_token_set} />
            </li>
            {aiBot.openclaw_url && (
              <li>
                <strong>URL:</strong>{" "}
                <code>{aiBot.openclaw_url}</code>
              </li>
            )}
          </ul>
        )}
      </section>

      <button type="button" className="btn secondary full-width" onClick={refresh}>
        Обновить
      </button>
    </div>
  );
}
