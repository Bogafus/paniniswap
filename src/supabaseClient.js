import { createClient } from "@supabase/supabase-js";

// Ces deux valeurs viennent de ton projet Supabase :
// Dashboard > Project Settings > API > "Project URL" et "anon public" key.
// Elles sont définies dans le fichier .env (en local) ou dans les
// variables d'environnement de Vercel (en production) — jamais codées en dur ici.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase non configuré : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
      "L'app fonctionnera en mode démo locale uniquement."
  );
}

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
