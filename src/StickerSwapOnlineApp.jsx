import React, { useState, useEffect, useCallback } from "react";
import JoinScreen from "./JoinScreen.jsx";
import { resumeSession, clearSession } from "./auth.js";
import {
  fetchMyInventory,
  upsertInventoryItem,
  fetchGroupMembersWithInventory,
  fetchMyTrades,
  createTrade,
  updateTradeStatus,
} from "./data.js";
import { InventoryView, MatchingView, TradesView, ProposalModal } from "./StickerSwap.jsx";

// Transforme une ligne "trades" Supabase (avec from_member/to_member joints)
// vers le format attendu par TradesView : { id, neighbor: {name}, give, get, method, status }
function mapTradeRow(row, myMemberId) {
  const iAmSender = row.from_member_id === myMemberId;
  const neighborName = iAmSender ? row.to_member?.display_name : row.from_member?.display_name;
  return {
    id: row.id,
    neighbor: { name: neighborName || "Voisin" },
    give: iAmSender ? row.give_stickers : row.get_stickers,
    get: iAmSender ? row.get_stickers : row.give_stickers,
    method: row.method,
    status: row.status === "cancelled" ? "cancelled" : row.status,
    raw: row,
    iAmSender,
  };
}

export default function StickerSwapOnlineApp() {
  const [session, setSession] = useState(undefined); // undefined = chargement, null = pas connecté
  const [mine, setMine] = useState({ doubles: {}, needs: {} });
  const [neighbors, setNeighbors] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activeGroup, setActiveGroup] = useState("A");
  const [screen, setScreen] = useState("inventory");
  const [proposal, setProposal] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  // Reprise de session au chargement
  useEffect(() => {
    resumeSession().then(setSession);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const reloadAll = useCallback(async () => {
    if (!session) return;
    setLoadingData(true);
    try {
      const [inv, members, tradeRows] = await Promise.all([
        fetchMyInventory(session.memberId),
        fetchGroupMembersWithInventory(session.groupId, session.memberId),
        fetchMyTrades(session.groupId, session.memberId),
      ]);
      setMine(inv);
      setNeighbors(members.map((m) => ({ id: m.id, name: m.name, inventory: m.inventory })));
      setTrades(tradeRows.map((r) => mapTradeRow(r, session.memberId)));
    } catch (err) {
      showToast(err.message || "Erreur de chargement, réessaie.");
    } finally {
      setLoadingData(false);
    }
  }, [session, showToast]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  if (session === undefined) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: "#F7F4ED" }}
      >
        <p className="font-display text-[14px] tracking-wide opacity-60" style={{ color: "#1C2B33" }}>
          CHARGEMENT…
        </p>
      </div>
    );
  }

  if (!session) {
    return <JoinScreen onJoined={setSession} />;
  }

  // Bascule "j'ai un double" / "j'ai besoin" : on optimise l'affichage tout de suite (optimistic update),
  // puis on écrit vraiment en base, et on resynchronise pour rester source-de-vérité-serveur.
  const handleSetMine = (updater) => {
    setMine((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Calcule le diff entre prev et next pour ne pousser que ce qui a changé
      const allIds = new Set([...Object.keys(prev.doubles), ...Object.keys(next.doubles), ...Object.keys(prev.needs), ...Object.keys(next.needs)]);
      allIds.forEach((id) => {
        const prevDouble = prev.doubles[id];
        const nextDouble = next.doubles[id];
        const prevNeed = prev.needs[id];
        const nextNeed = next.needs[id];
        if (prevDouble !== nextDouble) {
          upsertInventoryItem(session.memberId, id, nextDouble ? "double" : nextNeed ? "need" : null, nextDouble || 1).catch((err) =>
            showToast(err.message)
          );
        } else if (prevNeed !== nextNeed) {
          upsertInventoryItem(session.memberId, id, nextNeed ? "need" : nextDouble ? "double" : null, nextDouble || 1).catch((err) =>
            showToast(err.message)
          );
        }
      });
      return next;
    });
  };

  const handleSend = async (method, give, get) => {
    try {
      await createTrade({
        groupId: session.groupId,
        fromMemberId: session.memberId,
        toMemberId: proposal.neighbor.id,
        giveStickers: give,
        getStickers: get,
        method,
      });
      setProposal(null);
      showToast(`Demande envoyée à ${proposal.neighbor.name} · vignettes réservées`);
      setScreen("trades");
      reloadAll();
    } catch (err) {
      showToast(err.message || "Impossible d'envoyer la demande, réessaie.");
    }
  };

  const handleUpdateStatus = async (tradeId, status) => {
    try {
      await updateTradeStatus(tradeId, status);
      reloadAll();
    } catch (err) {
      showToast(err.message || "Impossible de mettre à jour l'échange.");
    }
  };

  const handleCancel = async (tradeId) => {
    try {
      await updateTradeStatus(tradeId, "cancelled");
      showToast("Échange annulé · vignettes libérées");
      reloadAll();
    } catch (err) {
      showToast(err.message || "Impossible d'annuler l'échange.");
    }
  };

  const visibleTrades = trades.filter((t) => t.status !== "cancelled");
  const navItems = [
    { id: "inventory", label: "Carnet" },
    { id: "matching", label: "Suggestions" },
    { id: "trades", label: "Échanges", badge: visibleTrades.filter((t) => t.status === "pending").length },
  ];

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "#F7F4ED", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
      `}</style>

      <div
        className="px-5 pt-6 pb-3 sticky top-0 z-10 flex items-center justify-between"
        style={{ background: "#F7F4ED", borderBottom: "1px solid #E4E1D8" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-9 rounded-[3px] flex items-center justify-center font-display text-[11px]"
            style={{ background: "#1C2B33", color: "#F7F4ED", transform: "rotate(-4deg)" }}
          >
            26
          </div>
          <div>
            <div className="font-display text-[19px] tracking-wide leading-none" style={{ color: "#1C2B33" }}>
              PANINISWAP
            </div>
            <div className="text-[11px] opacity-55 leading-none mt-0.5">
              {session.displayName} · {session.groupName}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            clearSession();
            setSession(null);
          }}
          className="text-[11px] underline opacity-50"
          style={{ color: "#1C2B33" }}
        >
          changer de compte
        </button>
      </div>

      <div className="px-5 py-4 max-w-md mx-auto pb-24">
        {screen === "inventory" && (
          <InventoryView mine={mine} setMine={handleSetMine} activeGroup={activeGroup} setActiveGroup={setActiveGroup} />
        )}
        {screen === "matching" && (
          <MatchingView
            mine={mine}
            neighbors={neighbors}
            groupName={session.groupName}
            onOpenProposal={(neighbor, iCanGive, theyCanGive) => setProposal({ neighbor, iCanGive, theyCanGive })}
          />
        )}
        {screen === "trades" && (
          <TradesView trades={visibleTrades} onUpdateStatus={handleUpdateStatus} onCancel={handleCancel} />
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 flex justify-center"
        style={{ background: "#F7F4ED", borderTop: "1px solid #E4E1D8" }}
      >
        <div className="flex w-full max-w-md">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 relative"
            >
              <span
                className="font-display text-[12px] tracking-wide"
                style={{ color: screen === item.id ? "#E8543E" : "#1C2B33", opacity: screen === item.id ? 1 : 0.55 }}
              >
                {item.label.toUpperCase()}
              </span>
              <div
                className="h-[3px] w-8 rounded-full mt-0.5"
                style={{ background: screen === item.id ? "#E8543E" : "transparent" }}
              />
              {item.badge > 0 && (
                <span
                  className="absolute top-1.5 right-[28%] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                  style={{ background: "#E8543E", color: "#F7F4ED" }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-[10px] text-[13px] z-50 max-w-[85%] text-center"
          style={{ background: "#1C2B33", color: "#F7F4ED" }}
        >
          {toast}
        </div>
      )}

      {loadingData && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] z-50"
          style={{ background: "#EDEAE1", color: "#1C2B33" }}
        >
          Synchronisation…
        </div>
      )}

      {proposal && <ProposalModal proposal={proposal} onClose={() => setProposal(null)} onSend={handleSend} />}
    </div>
  );
}
