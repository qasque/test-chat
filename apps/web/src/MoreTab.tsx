import { getChatwootUrl } from "./config";
import ChatwootDialogsNav from "./ChatwootDialogsNav";

export default function MoreTab() {
  const chatwootUrl = getChatwootUrl();

  return (
    <div className="more-tab">
      <section className="card accent">
        <h2>Панель операторов</h2>
        <p>
          Рабочее место агентов — это веб-интерфейс Chatwoot (диалоги, инбоксы,
          команды).
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

      <section className="card">
        <h2>О приложении</h2>
        <p className="muted small">
          Портал поддержки v1.1 — Chatwoot, Telegram Bridge, AI-бот
        </p>
      </section>
    </div>
  );
}
