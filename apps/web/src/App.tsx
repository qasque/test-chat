import { useCallback, useEffect, useState } from "react";
import { getBridgeHealthUrl, getChatwootUrl } from "./config";
import BotSetup from "./BotSetup";
import ChatwootDialogsNav from "./ChatwootDialogsNav";
import "./App.css";

type Health = {
  ok?: boolean;
  service?: string;
  outboundQueueSize?: number;
};

export default function App() {
  const chatwootUrl = getChatwootUrl();
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(getBridgeHealthUrl(), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as Health;
      setHealth(j);
    } catch (e) {
      setHealth(null);
      setErr(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="layout">
      <header className="header">
        <h1>Портал поддержки</h1>
        <p className="subtitle">
          Chatwoot, мост Telegram и операторская панель — в одном месте
        </p>
      </header>

      <main className="grid">
        <BotSetup />

        <section className="card">
          <h2>Состояние моста</h2>
          {loading && !health && !err && <p className="muted">Загрузка…</p>}
          {err && (
            <p className="error">
              Недоступно: {err}
              <br />
              <span className="muted small">
                Убедитесь, что сервис telegram-bridge запущен (порт 4000).
              </span>
            </p>
          )}
          {health?.ok && (
            <ul className="list">
              <li>
                <strong>Сервис:</strong> {health.service ?? "—"}
              </li>
              <li>
                <strong>Очередь исходящих:</strong>{" "}
                {health.outboundQueueSize ?? 0}
              </li>
            </ul>
          )}
          <button type="button" className="btn secondary" onClick={refresh}>
            Обновить
          </button>
        </section>

        <section className="card accent">
          <h2>Панель операторов</h2>
          <p>
            Рабочее место агентов — это веб-интерфейс Chatwoot (диалоги,
            инбоксы, команды).
          </p>
          <ChatwootDialogsNav />
          <a
            className="btn primary"
            href={chatwootUrl}
            target="_blank"
            rel="noreferrer"
          >
            Открыть Chatwoot
          </a>
          <p className="muted small">
            URL: <code>{chatwootUrl}</code>
          </p>
        </section>

        <section className="card">
          <h2>Клиенты на сайте</h2>
          <p>
            Виджет чата для сайта и личного кабинета настраивается в Chatwoot
            (Website Inbox) и вставляется на страницу.
          </p>
          <p className="muted small">
            Пример кода: <code>examples/widget-embed.html</code> в репозитории
            инфраструктуры.
          </p>
        </section>
      </main>

      <footer className="footer muted small">
        Десктопное приложение использует этот же интерфейс; при проблемах с
        встраиванием Chatwoot в окно откройте панель в браузере.
      </footer>
    </div>
  );
}
