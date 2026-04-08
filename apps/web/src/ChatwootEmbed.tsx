import { useMemo } from "react";
import { getChatwootAppLinks } from "./chatwootLinks";
import "./ChatwootEmbed.css";

export default function ChatwootEmbed() {
  const links = useMemo(() => getChatwootAppLinks(), []);

  return (
    <div className="cw-embed">
      <iframe
        className="cw-embed__frame"
        src={links.dashboard}
        title="Chatwoot"
        allow="clipboard-write; clipboard-read"
      />
    </div>
  );
}
