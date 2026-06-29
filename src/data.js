import { supabase } from "./supabaseClient.js";

// ---------- Réservations : vignettes déjà engagées dans un échange actif ----------

// Récupère tous les échanges actifs (pending/accepted, pas cancelled/done) d'un
// groupe, et retourne pour chaque personne combien d'unités de chaque vignette
// elle a déjà promises (give) ou s'attend à recevoir (get). Sert à exclure ces
// vignettes du matching et de l'inventaire "disponible", pour éviter qu'une
// même vignette soit proposée à deux personnes différentes en même temps.
async function fetchActiveReservations(groupId) {
  const { data, error } = await supabase
    .from("trades")
    .select("from_person_id, to_person_id, give_stickers, get_stickers, status")
    .eq("group_id", groupId)
    .in("status", ["pending", "accepted"]);
  if (error) throw error;

  // reservedGive[personId][stickerId] = quantité déjà promise à donner
  // reservedGet[personId][stickerId] = quantité déjà attendue à recevoir
  const reservedGive = {};
  const reservedGet = {};

  const addCount = (map, personId, stickerId) => {
    if (!map[personId]) map[personId] = {};
    map[personId][stickerId] = (map[personId][stickerId] || 0) + 1;
  };

  (data || []).forEach((trade) => {
    (trade.give_stickers || []).forEach((stickerId) => addCount(reservedGive, trade.from_person_id, stickerId));
    (trade.get_stickers || []).forEach((stickerId) => addCount(reservedGet, trade.from_person_id, stickerId));
    // Du point de vue du destinataire (to_person), c'est l'inverse : ce qu'il reçoit
    // (give_stickers de l'expéditeur) est ce qu'IL attend, et ce qu'il donne, c'est get_stickers.
    (trade.give_stickers || []).forEach((stickerId) => addCount(reservedGet, trade.to_person_id, stickerId));
    (trade.get_stickers || []).forEach((stickerId) => addCount(reservedGive, trade.to_person_id, stickerId));
  });

  return { reservedGive, reservedGet };
}

// Applique les réservations à un inventaire {doubles, needs} pour une personne donnée :
// les quantités déjà promises sont retirées des doubles disponibles, et les
// vignettes déjà attendues dans un échange en cours sont retirées des besoins
// (pas la peine de les proposer à nouveau ailleurs tant que l'échange est actif).
function applyReservations(inventory, personId, reservedGive, reservedGet) {
  const doubles = { ...inventory.doubles };
  const needs = { ...inventory.needs };

  const givenAway = reservedGive[personId] || {};
  Object.entries(givenAway).forEach(([stickerId, qty]) => {
    const remaining = (doubles[stickerId] || 0) - qty;
    if (remaining > 0) doubles[stickerId] = remaining;
    else delete doubles[stickerId];
  });

  const incoming = reservedGet[personId] || {};
  Object.keys(incoming).forEach((stickerId) => {
    delete needs[stickerId];
  });

  return { doubles, needs };
}

// ---------- Inventaire (rattaché à la PERSONNE, partagé entre tous ses groupes) ----------

// Charge l'inventaire (doubles + besoins) d'une personne, au même format
// que l'état local "mine" utilisé par le composant StickerSwap.
export async function fetchMyInventory(personId) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("sticker_id, status, quantity")
    .eq("person_id", personId);
  if (error) throw error;

  const doubles = {};
  const needs = {};
  (data || []).forEach((row) => {
    if (row.status === "double") doubles[row.sticker_id] = row.quantity;
    else needs[row.sticker_id] = true;
  });
  return { doubles, needs };
}

// Variante de fetchMyInventory qui exclut les vignettes déjà engagées dans un
// échange actif de ce groupe — c'est cette version qu'il faut utiliser pour le
// matching et pour la sélection de vignettes à proposer (pas pour l'écran
// "Mon carnet", qui doit montrer le stock réel).
export async function fetchMyAvailableInventory(personId, groupId) {
  const [inventory, { reservedGive, reservedGet }] = await Promise.all([
    fetchMyInventory(personId),
    fetchActiveReservations(groupId),
  ]);
  return applyReservations(inventory, personId, reservedGive, reservedGet);
}

// Met à jour (ou crée) une ligne d'inventaire pour une vignette donnée.
// quantity=0 ou status=null supprime la ligne.
export async function upsertInventoryItem(personId, stickerId, status, quantity = 1) {
  if (!status) {
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("person_id", personId)
      .eq("sticker_id", stickerId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("inventory_items")
    .upsert(
      { person_id: personId, sticker_id: stickerId, status, quantity, updated_at: new Date().toISOString() },
      { onConflict: "person_id,sticker_id" }
    );
  if (error) throw error;
}

// ---------- Membres du groupe (pour le matching) ----------

// Récupère toutes les autres personnes du groupe (via person_groups) avec leur
// inventaire DISPONIBLE (déjà net des vignettes engagées dans un échange actif,
// pour ce groupe), au même format que NEIGHBOR_INVENTORIES dans le prototype.
export async function fetchGroupMembersWithInventory(groupId, excludePersonId) {
  const { data: links, error: linksError } = await supabase
    .from("person_groups")
    .select("person_id, people(id, display_name)")
    .eq("group_id", groupId)
    .neq("person_id", excludePersonId);
  if (linksError) throw linksError;

  const persons = (links || []).map((l) => l.people).filter(Boolean);
  if (persons.length === 0) return [];

  const personIds = persons.map((p) => p.id);
  const [{ data: items, error: itemsError }, { reservedGive, reservedGet }] = await Promise.all([
    supabase.from("inventory_items").select("person_id, sticker_id, status, quantity").in("person_id", personIds),
    fetchActiveReservations(groupId),
  ]);
  if (itemsError) throw itemsError;

  return persons.map((p) => {
    const doubles = {};
    const needs = {};
    (items || [])
      .filter((row) => row.person_id === p.id)
      .forEach((row) => {
        if (row.status === "double") doubles[row.sticker_id] = row.quantity;
        else needs[row.sticker_id] = true;
      });
    const available = applyReservations({ doubles, needs }, p.id, reservedGive, reservedGet);
    return {
      id: p.id,
      name: p.display_name,
      inventory: available,
    };
  });
}

// ---------- Échanges (toujours rattachés à un groupe précis) ----------

export async function fetchMyTrades(groupId, personId) {
  const { data, error } = await supabase
    .from("trades")
    .select("*, from_person:from_person_id(display_name), to_person:to_person_id(display_name)")
    .eq("group_id", groupId)
    .or(`from_person_id.eq.${personId},to_person_id.eq.${personId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTrade({ groupId, fromPersonId, toPersonId, giveStickers, getStickers, method }) {
  const { data, error } = await supabase
    .from("trades")
    .insert({
      group_id: groupId,
      from_person_id: fromPersonId,
      to_person_id: toPersonId,
      give_stickers: giveStickers,
      get_stickers: getStickers,
      method,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTradeStatus(tradeId, status) {
  const { error } = await supabase
    .from("trades")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", tradeId);
  if (error) throw error;
}

// Marque le carnet d'un côté donné (expéditeur ou destinataire) comme déjà
// traité suite à un échange, en précisant le choix fait : "auto" (carnet mis
// à jour automatiquement) ou "manual" (la personne s'en occupe elle-même).
// Empêche d'afficher à nouveau la proposition pour cet échange, et permet
// d'afficher le bon badge ("Carnet mis à jour" vs "À mettre à jour manuellement").
export async function markInventoryApplied(tradeId, isSender, choice) {
  const appliedColumn = isSender ? "inventory_applied_from" : "inventory_applied_to";
  const choiceColumn = isSender ? "inventory_choice_from" : "inventory_choice_to";
  const { error } = await supabase
    .from("trades")
    .update({ [appliedColumn]: true, [choiceColumn]: choice })
    .eq("id", tradeId);
  if (error) throw error;
}

// ---------- Messages d'échange (chat lié à un trade précis) ----------

export async function fetchTradeMessages(tradeId) {
  const { data, error } = await supabase
    .from("trade_messages")
    .select("id, sender_person_id, content, created_at, people:sender_person_id(display_name)")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    senderId: row.sender_person_id,
    senderName: row.people?.display_name || "?",
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function sendTradeMessage(tradeId, senderPersonId, content) {
  const { error } = await supabase
    .from("trade_messages")
    .insert({ trade_id: tradeId, sender_person_id: senderPersonId, content: content.trim() });
  if (error) throw error;
}

// ---------- Statut de lecture (pour le badge "nouveaux messages" sur le bouton de chat) ----------

// Retourne, pour une liste de trade_id donnée, le nombre de messages non lus
// par cette personne dans chacun (messages envoyés par quelqu'un d'autre,
// postérieurs à la dernière fois que cette personne a ouvert ce chat).
export async function fetchUnreadCounts(tradeIds, personId) {
  if (!tradeIds || tradeIds.length === 0) return {};

  const [{ data: reads, error: readsError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("trade_read_status").select("trade_id, last_read_at").eq("person_id", personId).in("trade_id", tradeIds),
    supabase.from("trade_messages").select("trade_id, sender_person_id, created_at").in("trade_id", tradeIds),
  ]);
  if (readsError) throw readsError;
  if (messagesError) throw messagesError;

  const lastReadByTrade = {};
  (reads || []).forEach((r) => {
    lastReadByTrade[r.trade_id] = r.last_read_at;
  });

  const counts = {};
  (messages || []).forEach((m) => {
    if (m.sender_person_id === personId) return; // mes propres messages ne comptent jamais comme "non lus"
    const lastRead = lastReadByTrade[m.trade_id];
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      counts[m.trade_id] = (counts[m.trade_id] || 0) + 1;
    }
  });
  return counts;
}

// Marque un échange comme "lu maintenant" par cette personne (à appeler quand
// le chat de cet échange est ouvert).
export async function markTradeRead(tradeId, personId) {
  const { error } = await supabase
    .from("trade_read_status")
    .upsert({ trade_id: tradeId, person_id: personId, last_read_at: new Date().toISOString() }, { onConflict: "trade_id,person_id" });
  if (error) throw error;
}
