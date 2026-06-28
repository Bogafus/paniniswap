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

// Génère un PIN à 4 chiffres pour la vérification d'identité multi-appareil.
function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
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

// Vérifie si un prénom est déjà pris sur le site (insensible à la casse).
export async function checkNameAvailable(displayName) {
  const { data, error } = await supabase
    .from("people")
    .select("id")
    .ilike("display_name", displayName.trim())
    .maybeSingle();
  if (error) throw error;
  return !data; // true = disponible
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

// Crée une toute nouvelle personne avec ce prénom (le prénom doit déjà avoir
// été vérifié comme disponible). Retourne aussi le PIN généré, à afficher une
// seule fois à l'écran pour que la personne le note.
async function createNewPerson(displayName) {
  const pin = generatePin();
  const { data, error } = await supabase
    .from("people")
    .insert({ display_name: displayName.trim(), pin })
    .select()
    .single();
  if (error) {
    // Contrainte d'unicité violée = quelqu'un a pris ce prénom entre la
    // vérification et la création (cas rare mais possible).
    if (error.code === "23505") {
      throw new Error("Ce prénom vient juste d'être pris par quelqu'un d'autre. Essaie une variante.");
    }
    throw error;
  }
  return { person: data, generatedPin: pin };
}

// Rejoint un groupe via son code. Trois cas possibles :
// 1) Le prénom est libre -> on crée une nouvelle personne (avec un PIN généré, retourné à afficher).
// 2) Le prénom existe déjà ET c'est cet appareil qui l'a créé (device_token reconnu) -> reconnexion directe.
// 3) Le prénom existe déjà mais sur un autre appareil -> il faut le PIN pour prouver l'identité.
export async function joinGroup(groupCode, displayName, pinIfNeeded) {
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

  const trimmedName = displayName.trim();
  const { data: existing, error: existingError } = await supabase
    .from("people")
    .select("*")
    .ilike("display_name", trimmedName)
    .maybeSingle();
  if (existingError) throw existingError;

  let person;
  let generatedPin = null;

  if (!existing) {
    // Cas 1 : prénom libre, nouvelle personne
    const created = await createNewPerson(trimmedName);
    person = created.person;
    generatedPin = created.generatedPin;
  } else {
    const storedToken = loadSession()?.deviceToken;
    if (storedToken && storedToken === existing.device_token) {
      // Cas 2 : c'est bien cet appareil qui a créé ce compte, reconnexion directe
      person = existing;
    } else if (!existing.pin) {
      // Compte ancien (migré) sans PIN encore défini : on ne peut pas vérifier
      // l'identité depuis un nouvel appareil. On bloque par sécurité.
      throw new Error(
        "Ce prénom existe déjà mais n'a pas encore de code de vérification. Connecte-toi depuis l'appareil habituel pour en créer un, ou choisis un autre prénom."
      );
    } else if (pinIfNeeded && pinIfNeeded === existing.pin) {
      // Cas 3 : bon PIN fourni, on reconnaît la personne et on met à jour son appareil
      const { data: updated, error: updateError } = await supabase
        .from("people")
        .update({ device_token: crypto.randomUUID() })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      person = updated;
    } else if (pinIfNeeded) {
      throw new Error("Code de vérification incorrect.");
    } else {
      // Prénom pris, pas encore de PIN fourni : on signale qu'une vérification est nécessaire
      const err = new Error("NAME_TAKEN_NEEDS_PIN");
      err.code = "NAME_TAKEN_NEEDS_PIN";
      throw err;
    }
  }

  const { error: linkError } = await supabase
    .from("person_groups")
    .upsert({ person_id: person.id, group_id: group.id }, { onConflict: "person_id,group_id" });
  if (linkError) throw linkError;

  const session = {
    personId: person.id,
    displayName: person.display_name,
    deviceToken: person.device_token,
    groupId: group.id,
    groupName: group.name,
    groupCode: group.code,
  };
  saveSession(session);
  return { session, generatedPin };
}

// Reconnexion automatique depuis la session stockée localement.
export async function resumeSession() {
  const session = loadSession();
  if (!session || !supabase) return null;

  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", session.personId)
    .eq("device_token", session.deviceToken)
    .maybeSingle();

  if (error || !person) {
    clearSession();
    return null;
  }

  return {
    ...session,
    personId: person.id,
    displayName: person.display_name,
    deviceToken: person.device_token,
    hasPin: !!person.pin,
  };
}

// Permet à une personne migrée (sans PIN) d'en créer un.
export async function setMyPin(personId, pin) {
  const { error } = await supabase.from("people").update({ pin }).eq("id", personId);
  if (error) throw error;
}

// Liste tous les groupes auxquels une personne appartient (pour le sélecteur de groupe).
export async function fetchMyGroups(personId) {
  const { data, error } = await supabase
    .from("person_groups")
    .select("group_id, groups(id, name, code)")
    .eq("person_id", personId);
  if (error) throw error;
  return (data || []).map((row) => row.groups).filter(Boolean);
}

// Change le groupe actuellement affiché, sans changer de personne ni d'inventaire.
export function switchActiveGroup(session, group) {
  const updated = {
    ...session,
    groupId: group.id,
    groupName: group.name,
    groupCode: group.code,
  };
  saveSession(updated);
  return updated;
}
