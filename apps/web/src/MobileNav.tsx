import "./MobileNav.css";

export type TabId = "chats" | "status" | "setup" | "more";

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: "chats", label: "Чаты", icon: "💬" },
  { id: "status", label: "Статус", icon: "📡" },
  { id: "setup", label: "Настройка", icon: "⚙️" },
  { id: "more", label: "Ещё", icon: "☰" },
];

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

export default function MobileNav({ active, onChange }: Props) {
  return (
    <nav className="mobile-nav" aria-label="Навигация">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`mobile-nav__tab${active === t.id ? " active" : ""}`}
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? "page" : undefined}
        >
          <span className="mobile-nav__icon" aria-hidden>
            {t.icon}
          </span>
          <span className="mobile-nav__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
