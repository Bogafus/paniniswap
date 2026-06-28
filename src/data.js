import { supabase } from "./supabaseClient.js";

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
// inventaire, au même format que NEIGHBOR_INVENTORIES dans le prototype.
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
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("person_id, sticker_id, status, quantity")
    .in("person_id", personIds);
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
    return {
      id: p.id,
      name: p.display_name,
      inventory: { doubles, needs },
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
