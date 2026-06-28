import { supabase } from "./supabaseClient.js";

const STORAGE_KEY = "paniniswap_session";

// Génère un code de groupe lisible et facile à partager à voix haute / par message,
// ex: "EIB-7F3K" — préfixe basé sur le nom, suffixe aléatoire pour l'unicité.
function generateGroupCode(name) {
  const prefix = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || "GRP";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Crée un nouveau groupe (ex: "EIB") et retourne son code secret à partager.
export async function createGroup(groupName) {
  if (!supabase) throw new Error("Supabase non configuré");
  const code = generateGroupCode(groupName);
  const { data, error } = await supabase
    .from("groups")
    .insert({ name: groupName, code })
    .select()
    .single();
  if (error) throw error;
  return data; // { id, name, code, created_at }
}

// Rejoint un groupe existant via son code, en s'identifiant par prénom.
// Si ce prénom existe déjà dans ce groupe sur cet appareil-ci, on le retrouve;
// sinon on crée un nouveau membre.
export async function joinGroup(groupCode, displayName) {
  if (!supabase) throw new Error("Supabase non configuré");

  const normalizedCode = groupCode.trim().toUpperCase();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("code", normalizedCode)
    .single();

  if (groupError || !group) {
    throw new Error("Code de groupe introuvable. Vérifie l'orthographe avec la personne qui te l'a partagé.");
  }

  // Cherche un membre existant avec ce prénom dans ce groupe
  const { data: existing } = await supabase
    .from("members")
    .select("*")
    .eq("group_id", group.id)
    .eq("display_name", displayName.trim())
    .maybeSingle();

  let member = existing;
  if (!member) {
    const { data: created, error: createError } = await supabase
      .from("members")
      .insert({ group_id: group.id, display_name: displayName.trim() })
      .select()
      .single();
    if (createError) throw createError;
    member = created;
  }

  const session = {
    groupId: group.id,
    groupName: group.name,
    groupCode: group.code,
    memberId: member.id,
    displayName: member.display_name,
    deviceToken: member.device_token,
  };
  saveSession(session);
  return session;
}

// Reconnexion automatique depuis la session stockée localement,
// avec vérification que le membre existe toujours côté serveur.
export async function resumeSession() {
  const session = loadSession();
  if (!session || !supabase) return null;

  const { data: member, error } = await supabase
    .from("members")
    .select("*, groups(name, code)")
    .eq("id", session.memberId)
    .eq("device_token", session.deviceToken)
    .maybeSingle();

  if (error || !member) {
    clearSession();
    return null;
  }

  return {
    groupId: member.group_id,
    groupName: member.groups?.name ?? session.groupName,
    groupCode: member.groups?.code ?? session.groupCode,
    memberId: member.id,
    displayName: member.display_name,
    deviceToken: member.device_token,
  };
}
