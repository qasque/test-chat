import { useState } from "react";
import MobileNav, { type TabId } from "./MobileNav";
import ChatwootEmbed from "./ChatwootEmbed";
import StatusTab from "./StatusTab";
import BotSetup from "./BotSetup";
import MoreTab from "./MoreTab";
import { getPortalUiMode } from "./config";
import "./App.css";

const STORAGE_TAB = "portal.activeTab";

function readSavedTab(): TabId {
  try {
    const v = localStorage.getItem(STORAGE_TAB);
    if (v === "chats" || v === "status" || v === "setup" || v === "more")
      return v;
  } catch { /* ignore */ }
  return "chats";
}

export default function App() {
  const operatorUi = getPortalUiMode() === "operator";
  const [tab, setTab] = useState<TabId>(() =>
    operatorUi ? "chats" : readSavedTab(),
  );

  const changeTab = (id: TabId) => {
    setTab(id);
    try { localStorage.setItem(STORAGE_TAB, id); } catch { /* ignore */ }
  };

  return (
    <div className={`app-shell${operatorUi ? " app-shell--operator" : ""}`}>
      {!operatorUi && <MobileNav active={tab} onChange={changeTab} />}

      <div className="app-content">
        {(operatorUi || tab === "chats") && <ChatwootEmbed />}

        {!operatorUi && tab === "status" && (
          <div className="scroll-container">
            <header className="tab-header">
              <h1>Статус системы</h1>
              <p className="subtitle">
                Мониторинг сервисов моста и AI-бота
              </p>
            </header>
            <StatusTab />
          </div>
        )}

        {!operatorUi && tab === "setup" && (
          <div className="scroll-container">
            <header className="tab-header">
              <h1>Настройка</h1>
              <p className="subtitle">
                Конфигурация Telegram-бота и подключение к мосту
              </p>
            </header>
            <BotSetup />
          </div>
        )}

        {!operatorUi && tab === "more" && (
          <div className="scroll-container">
            <header className="tab-header">
              <h1>Портал поддержки</h1>
              <p className="subtitle">
                Chatwoot, мост Telegram и операторская панель — в одном месте
              </p>
            </header>
            <MoreTab />
          </div>
        )}
      </div>
    </div>
  );
}
