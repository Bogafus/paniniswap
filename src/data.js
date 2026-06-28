import { supabase } from "./supabaseClient.js";

// ---------- Inventaire ----------

// Charge l'inventaire (doubles + besoins) d'un membre, au même format
// que l'état local "mine" utilisé par le composant StickerSwap.
export async function fetchMyInventory(memberId) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("sticker_id, status, quantity")
    .eq("member_id", memberId);
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
export async function upsertInventoryItem(memberId, stickerId, status, quantity = 1) {
  if (!status) {
    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("member_id", memberId)
      .eq("sticker_id", stickerId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("inventory_items")
    .upsert(
      { member_id: memberId, sticker_id: stickerId, status, quantity, updated_at: new Date().toISOString() },
      { onConflict: "member_id,sticker_id" }
    );
  if (error) throw error;
}

// ---------- Membres du groupe (pour le matching) ----------

// Récupère tous les autres membres du groupe avec leur inventaire,
// au même format que NEIGHBOR_INVENTORIES dans le prototype.
export async function fetchGroupMembersWithInventory(groupId, excludeMemberId) {
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, display_name")
    .eq("group_id", groupId)
    .neq("id", excludeMemberId);
  if (membersError) throw membersError;

  if (!members || members.length === 0) return [];

  const memberIds = members.map((m) => m.id);
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("member_id, sticker_id, status, quantity")
    .in("member_id", memberIds);
  if (itemsError) throw itemsError;

  return members.map((m) => {
    const doubles = {};
    const needs = {};
    (items || [])
      .filter((row) => row.member_id === m.id)
      .forEach((row) => {
        if (row.status === "double") doubles[row.sticker_id] = row.quantity;
        else needs[row.sticker_id] = true;
      });
    return {
      id: m.id,
      name: m.display_name,
      inventory: { doubles, needs },
    };
  });
}

// ---------- Échanges ----------

export async function fetchMyTrades(groupId, memberId) {
  const { data, error } = await supabase
    .from("trades")
    .select("*, from_member:from_member_id(display_name), to_member:to_member_id(display_name)")
    .eq("group_id", groupId)
    .or(`from_member_id.eq.${memberId},to_member_id.eq.${memberId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTrade({ groupId, fromMemberId, toMemberId, giveStickers, getStickers, method }) {
  const { data, error } = await supabase
    .from("trades")
    .insert({
      group_id: groupId,
      from_member_id: fromMemberId,
      to_member_id: toMemberId,
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
