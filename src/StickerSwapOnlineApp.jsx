import React, { useState, useEffect, useCallback } from "react";
import JoinScreen from "./JoinScreen.jsx";
import { resumeSession, clearSession, fetchMyGroups, switchActiveGroup, setMyPin } from "./auth.js";
import {
  fetchMyInventory,
  fetchMyAvailableInventory,
  upsertInventoryItem,
  fetchGroupMembersWithInventory,
  fetchMyTrades,
  createTrade,
  updateTradeStatus,
} from "./data.js";
import { InventoryView, MatchingView, TradesView, ProposalModal, CompleteTradeModal } from "./StickerSwap.jsx";
import TradeChat from "./TradeChat.jsx";

// Transforme une ligne "trades" Supabase (avec from_person/to_person joints)
// vers le format attendu par TradesView : { id, neighbor: {name}, give, get, method, status }
function mapTradeRow(row, myPersonId) {
  const iAmSender = row.from_person_id === myPersonId;
  const neighborName = iAmSender ? row.to_person?.display_name : row.from_person?.display_name;
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
  const [myGroups, setMyGroups] = useState([]); // tous les groupes de cette personne
  const [mine, setMine] = useState({ doubles: {}, needs: {} });
  const [availableMine, setAvailableMine] = useState({ doubles: {}, needs: {} });
  const [neighbors, setNeighbors] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activeGroup, setActiveGroup] = useState("A");
  const [screen, setScreen] = useState("inventory");
  const [proposal, setProposal] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [showGroupSwitcher, setShowGroupSwitcher] = useState(false);
  const [pinSetupValue, setPinSetupValue] = useState("");
  const [pinSetupError, setPinSetupError] = useState(null);
  const [pinDismissed, setPinDismissed] = useState(false);
  const [completingTrade, setCompletingTrade] = useState(null);

  // Reprise de session au chargement
  useEffect(() => {
    resumeSession().then(setSession);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // L'inventaire est partagé entre tous les groupes (rattaché à la personne),
  // donc on le recharge dès qu'on a une session, indépendamment du groupe actif.
  const reloadInventory = useCallback(async () => {
    if (!session) return;
    try {
      const inv = await fetchMyInventory(session.personId);
      setMine(inv);
    } catch (err) {
      showToast(err.message || "Erreur de chargement du carnet.");
    }
  }, [session, showToast]);

  // Les suggestions et échanges, eux, dépendent du groupe actuellement affiché.
  const reloadGroupData = useCallback(async () => {
    if (!session) return;
    setLoadingData(true);
    try {
      const [members, tradeRows, groups, availableInv] = await Promise.all([
        fetchGroupMembersWithInventory(session.groupId, session.personId),
        fetchMyTrades(session.groupId, session.personId),
        fetchMyGroups(session.personId),
        fetchMyAvailableInventory(session.personId, session.groupId),
      ]);
      setNeighbors(members.map((m) => ({ id: m.id, name: m.name, inventory: m.inventory })));
      setTrades(tradeRows.map((r) => mapTradeRow(r, session.personId)));
      setMyGroups(groups);
      setAvailableMine(availableInv);
    } catch (err) {
      showToast(err.message || "Erreur de chargement, réessaie.");
    } finally {
      setLoadingData(false);
    }
  }, [session, showToast]);

  useEffect(() => {
    reloadInventory();
    reloadGroupData();
  }, [reloadInventory, reloadGroupData]);

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
  // puis on écrit vraiment en base (rattaché à la personne, donc visible dans tous ses groupes),
  // et on resynchronise les suggestions du groupe actif pour refléter le changement.
  const handleSetMine = (updater) => {
    setMine((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const allIds = new Set([...Object.keys(prev.doubles), ...Object.keys(next.doubles), ...Object.keys(prev.needs), ...Object.keys(next.needs)]);
      allIds.forEach((id) => {
        const prevDouble = prev.doubles[id];
        const nextDouble = next.doubles[id];
        const prevNeed = prev.needs[id];
        const nextNeed = next.needs[id];
        if (prevDouble !== nextDouble) {
          upsertInventoryItem(session.personId, id, nextDouble ? "double" : nextNeed ? "need" : null, nextDouble || 1).catch((err) =>
            showToast(err.message)
          );
        } else if (prevNeed !== nextNeed) {
          upsertInventoryItem(session.personId, id, nextNeed ? "need" : nextDouble ? "double" : null, nextDouble || 1).catch((err) =>
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
        fromPersonId: session.personId,
        toPersonId: proposal.neighbor.id,
        giveStickers: give,
        getStickers: get,
        method,
      });
      setProposal(null);
      showToast(`Demande envoyée à ${proposal.neighbor.name} · vignettes réservées`);
      setScreen("trades");
      reloadInventory();
      reloadGroupData();
    } catch (err) {
      showToast(err.message || "Impossible d'envoyer la demande, réessaie.");
    }
  };

  const handleUpdateStatus = async (tradeId, status) => {
    try {
      await updateTradeStatus(tradeId, status);
      reloadGroupData();
    } catch (err) {
      showToast(err.message || "Impossible de mettre à jour l'échange.");
    }
  };

  // Ouvre la modale de confirmation au lieu de marquer directement "done" :
  // on demande d'abord si le carnet doit être mis à jour automatiquement.
  const handleRequestComplete = (trade) => {
    setCompletingTrade(trade);
  };

  const handleConfirmComplete = async (trade, shouldUpdateInventory) => {
    setCompletingTrade(null);
    try {
      await updateTradeStatus(trade.id, "done");

      if (shouldUpdateInventory) {
        // Retire les vignettes données de mes doubles, et ajoute les vignettes
        // reçues (en double si je n'en avais pas, sinon +1). Si une vignette
        // reçue était dans mes besoins, elle en sort puisqu'elle est satisfaite.
        setMine((prev) => {
          const doubles = { ...prev.doubles };
          const needs = { ...prev.needs };

          trade.give.forEach((id) => {
            const remaining = (doubles[id] || 0) - 1;
            if (remaining > 0) {
              doubles[id] = remaining;
              upsertInventoryItem(session.personId, id, "double", remaining).catch((err) => showToast(err.message));
            } else {
              delete doubles[id];
              upsertInventoryItem(session.personId, id, null).catch((err) => showToast(err.message));
            }
          });

          trade.get.forEach((id) => {
            const next = (doubles[id] || 0) + 1;
            doubles[id] = next;
            delete needs[id];
            upsertInventoryItem(session.personId, id, "double", next).catch((err) => showToast(err.message));
          });

          return { doubles, needs };
        });
        showToast("Échange marqué comme réalisé · carnet mis à jour");
      } else {
        showToast("Échange marqué comme réalisé");
      }

      reloadGroupData();
    } catch (err) {
      showToast(err.message || "Impossible de mettre à jour l'échange.");
    }
  };

  const handleCancel = async (tradeId) => {
    try {
      await updateTradeStatus(tradeId, "cancelled");
      showToast("Échange annulé · vignettes libérées");
      reloadInventory();
      reloadGroupData();
    } catch (err) {
      showToast(err.message || "Impossible d'annuler l'échange.");
    }
  };

  const handleSwitchGroup = (group) => {
    const updated = switchActiveGroup(session, group);
    setSession(updated);
    setShowGroupSwitcher(false);
    showToast(`Groupe actif : ${group.name}`);
  };

  const handleSetupPin = async (e) => {
    e.preventDefault();
    setPinSetupError(null);
    if (pinSetupValue.length !== 4) {
      setPinSetupError("Le code doit faire exactement 4 chiffres.");
      return;
    }
    try {
      await setMyPin(session.personId, pinSetupValue);
      setSession((prev) => ({ ...prev, hasPin: true }));
      showToast("Code enregistré — tu pourras l'utiliser depuis un autre appareil.");
    } catch (err) {
      setPinSetupError(err.message || "Impossible d'enregistrer le code, réessaie.");
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
            <button
              onClick={() => setShowGroupSwitcher((v) => !v)}
              className="text-[11px] opacity-70 leading-none mt-0.5 flex items-center gap-1"
              style={{ color: "#1C2B33" }}
            >
              {session.displayName} · {session.groupName}
              {myGroups.length > 1 && <span aria-hidden="true">▾</span>}
            </button>
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

      {!session.hasPin && !pinDismissed && (
        <div className="px-5 pb-2 max-w-md mx-auto">
          <form
            onSubmit={handleSetupPin}
            className="rounded-[12px] p-3"
            style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(28,43,51,0.12)" }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[12px] leading-snug" style={{ color: "#1C2B33" }}>
                Si c'est ton premier login, change ton code PIN et note-le bien pour pouvoir te reconnecter depuis un autre appareil plus tard.
              </p>
              <button
                type="button"
                onClick={() => setPinDismissed(true)}
                className="text-[14px] opacity-40 shrink-0"
                style={{ color: "#1C2B33" }}
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={pinSetupValue}
                onChange={(e) => setPinSetupValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                inputMode="numeric"
                className="flex-1 px-3 py-2 rounded-[8px] font-display text-[15px] tracking-[0.3em] text-center outline-none"
                style={{ background: "#F7F4ED", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
              <button
                type="submit"
                className="px-4 rounded-[8px] font-display text-[12px] tracking-wide"
                style={{ background: "#3F8755", color: "#F7F4ED" }}
              >
                VALIDER
              </button>
            </div>
            {pinSetupError && (
              <p className="text-[11px] mt-1.5" style={{ color: "#E8543E" }}>
                {pinSetupError}
              </p>
            )}
          </form>
        </div>
      )}

      {showGroupSwitcher && myGroups.length > 1 && (
        <div className="px-5 pb-2 max-w-md mx-auto">
          <div className="rounded-[12px] p-2" style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(28,43,51,0.12)" }}>
            <p className="text-[11px] uppercase tracking-wide opacity-55 px-2 pt-1 pb-2">
              Ton carnet est partagé — change juste de vue
            </p>
            {myGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => handleSwitchGroup(g)}
                className="w-full text-left px-2 py-2 rounded-[8px] text-[13px] flex items-center justify-between"
                style={{
                  background: g.id === session.groupId ? "#EDEAE1" : "transparent",
                  color: "#1C2B33",
                }}
              >
                <span>{g.name}</span>
                {g.id === session.groupId && <span style={{ color: "#3F8755" }}>●</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-4 max-w-md mx-auto pb-24">
        {screen === "inventory" && (
          <InventoryView mine={mine} setMine={handleSetMine} activeGroup={activeGroup} setActiveGroup={setActiveGroup} />
        )}
        {screen === "matching" && (
          <MatchingView
            mine={availableMine}
            neighbors={neighbors}
            groupName={session.groupName}
            onOpenProposal={(neighbor, iCanGive, theyCanGive) => setProposal({ neighbor, iCanGive, theyCanGive })}
          />
        )}
        {screen === "trades" && (
          <TradesView
            trades={visibleTrades}
            onUpdateStatus={handleUpdateStatus}
            onCancel={handleCancel}
            onRequestComplete={handleRequestComplete}
            myPersonId={session.personId}
            ChatComponent={TradeChat}
          />
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
      {completingTrade && (
        <CompleteTradeModal
          trade={completingTrade}
          onClose={() => setCompletingTrade(null)}
          onConfirm={handleConfirmComplete}
        />
      )}
    </div>
  );
}
