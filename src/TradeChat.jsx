import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchTradeMessages, sendTradeMessage } from "./data.js";

// Chat simple attaché à un échange précis. Affiché en pli dépliable sous la
// carte de l'échange. Rafraîchit la liste toutes les 4 secondes pendant que
// le chat est ouvert (pas de websocket, juste un polling léger).
export default function TradeChat({ tradeId, myPersonId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const reload = useCallback(async () => {
    try {
      const msgs = await fetchTradeMessages(tradeId);
      setMessages(msgs);
    } catch (err) {
      setError(err.message || "Impossible de charger les messages.");
    }
  }, [tradeId]);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 4000);
    return () => clearInterval(interval);
  }, [reload]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    setError(null);
    try {
      await sendTradeMessage(tradeId, myPersonId, content);
      setDraft("");
      await reload();
    } catch (err) {
      setError(err.message || "Message non envoyé, réessaie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 rounded-[10px] overflow-hidden" style={{ background: "#F7F4ED", border: "1px solid #E4E1D8" }}>
      <div ref={scrollRef} className="max-h-[180px] overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 && (
          <p className="text-[11px] opacity-50 text-center py-2">
            Aucun message pour l'instant — propose ici où et quand échanger.
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.senderId === myPersonId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[80%] px-2.5 py-1.5 rounded-[8px] text-[12px]"
                style={{
                  background: isMine ? "#1C2B33" : "#EDEAE1",
                  color: isMine ? "#F7F4ED" : "#1C2B33",
                }}
              >
                {!isMine && (
                  <div className="text-[10px] opacity-60 mb-0.5 font-display tracking-wide">
                    {m.senderName.toUpperCase()}
                  </div>
                )}
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} className="flex gap-1.5 px-2 py-2" style={{ borderTop: "1px solid #E4E1D8" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 px-2.5 py-1.5 rounded-[8px] text-[12px] outline-none"
          style={{ background: "#FFFFFF", border: "1px solid #C8CDD1", color: "#1C2B33" }}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="px-3 rounded-[8px] font-display text-[11px] tracking-wide disabled:opacity-40"
          style={{ background: "#3F8755", color: "#F7F4ED" }}
        >
          ENVOYER
        </button>
      </form>
      {error && (
        <p className="text-[11px] px-3 pb-2" style={{ color: "#E8543E" }}>
          {error}
        </p>
      )}
    </div>
  );
}
