import { useMemo, useState } from "react";
import { getChatwootAppLinks } from "./chatwootLinks";
import "./ChatwootDialogsNav.css";

export default function ChatwootDialogsNav() {
  const [open, setOpen] = useState(true);
  const links = useMemo(() => getChatwootAppLinks(), []);

  const items: { label: string; href: string; hint?: string }[] = [
    { label: "Диалоги", href: links.dashboard },
    { label: "Упоминания", href: links.mentions },
    { label: "Неотвеченные", href: links.unattended },
    { label: "Быстрые ответы", href: links.cannedResponses },
    {
      label: "Заметки",
      href: links.notesHint,
      hint:
        "В открытом диалоге внизу переключите «Ответить» → «Личная заметка» (как в панели Chatwoot).",
    },
  ];

  return (
    <div className="cw-dialogs">
      <button
        type="button"
        className="cw-dialogs__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="cw-dialogs__icon" aria-hidden>
          ○
        </span>
        <span className="cw-dialogs__title">Диалоги</span>
        <span className="cw-dialogs__chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <nav className="cw-dialogs__tree" aria-label="Разделы Chatwoot">
          <ul className="cw-dialogs__list">
            {items.map(({ label, href, hint }) => (
              <li key={label} className="cw-dialogs__item">
                <a
                  className="cw-dialogs__link"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={hint}
                >
                  {label}
                </a>
                {hint && label === "Заметки" && (
                  <p className="cw-dialogs__hint muted small">{hint}</p>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
