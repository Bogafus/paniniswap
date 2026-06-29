import React, { useState } from "react";
import { createGroup, joinGroup } from "./auth.js";

const PREFILL_KEY = "paniniswap_join_prefill";

function loadPrefill() {
  try {
    const raw = localStorage.getItem(PREFILL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefill(values) {
  try {
    localStorage.setItem(PREFILL_KEY, JSON.stringify(values));
  } catch {
    // pas grave si ça échoue (ex: stockage plein) — juste pas de pré-remplissage la prochaine fois
  }
}

export default function JoinScreen({ onJoined }) {
  const prefill = loadPrefill();
  const [mode, setMode] = useState("join"); // join | create
  const [groupCode, setGroupCode] = useState(prefill.groupCode || "");
  const [groupName, setGroupName] = useState("");
  const [displayName, setDisplayName] = useState(prefill.displayName || "");
  const [pin, setPin] = useState(prefill.pin || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdCode, setCreatedCode] = useState(null);
  const [revealedPin, setRevealedPin] = useState(null);

  const performJoin = async (code, name, pinValue) => {
    try {
      const { session, generatedPin } = await joinGroup(code, name, pinValue || undefined);
      // On mémorise ce qui a marché, pour pré-remplir la prochaine fois.
      savePrefill({ groupCode: code, displayName: name, pin: generatedPin || pinValue || "" });
      if (generatedPin) {
        // Nouvelle personne : on affiche son PIN une seule fois avant de continuer,
        // pour qu'elle puisse le noter avant de l'oublier (même s'il est aussi pré-rempli ensuite).
        setRevealedPin({ pin: generatedPin, session });
      } else {
        onJoined(session);
      }
    } catch (err) {
      if (err.code === "NAME_TAKEN_NEEDS_PIN") {
        setError("Ce prénom existe déjà. Si c'est toi, vérifie ton code à 4 chiffres ci-dessous.");
      } else {
        setError(err.message || "Une erreur est survenue, réessaie.");
      }
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const group = await createGroup(groupName.trim());
      setCreatedCode(group.code);
      await performJoin(group.code, displayName.trim(), pin || null);
    } catch (err) {
      setError(err.message || "Une erreur est survenue, réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await performJoin(groupCode.trim(), displayName.trim(), pin || null);
    } finally {
      setLoading(false);
    }
  };

  // Écran de confirmation du PIN nouvellement généré, avant d'entrer dans l'app.
  if (revealedPin) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-5"
        style={{ background: "#F7F4ED", fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
          .font-display { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
        `}</style>
        <div className="w-full max-w-sm text-center">
          <p className="font-display text-[18px] tracking-wide mb-2" style={{ color: "#1C2B33" }}>
            BIENVENUE, {revealedPin.session.displayName.toUpperCase()} !
          </p>
          <p className="text-[13px] opacity-70 mb-4 leading-relaxed">
            Voici ton code personnel à 4 chiffres. Il est déjà mémorisé sur cet appareil — tu n'auras qu'à le confirmer la prochaine fois.
          </p>
          <div className="rounded-[14px] py-5 mb-5" style={{ background: "#1C2B33" }}>
            <span className="font-display text-[36px] tracking-[0.3em]" style={{ color: "#F7F4ED" }}>
              {revealedPin.pin}
            </span>
          </div>
          <button
            onClick={() => onJoined(revealedPin.session)}
            className="w-full py-3 rounded-[12px] font-display text-[14px] tracking-wide"
            style={{ background: "#3F8755", color: "#F7F4ED" }}
          >
            C'EST NOTÉ, CONTINUER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-5"
      style={{ background: "#F7F4ED", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
      `}</style>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div
            className="w-7 h-9 rounded-[3px] flex items-center justify-center font-display text-[11px]"
            style={{ background: "#1C2B33", color: "#F7F4ED", transform: "rotate(-4deg)" }}
          >
            26
          </div>
          <span className="font-display text-[22px] tracking-wide" style={{ color: "#1C2B33" }}>
            PANINISWAP
          </span>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setMode("join"); setError(null); }}
            className="flex-1 py-2 rounded-[10px] font-display text-[13px] tracking-wide transition-colors"
            style={{
              background: mode === "join" ? "#1C2B33" : "#EDEAE1",
              color: mode === "join" ? "#F7F4ED" : "#1C2B33",
            }}
          >
            REJOINDRE UN GROUPE
          </button>
          <button
            onClick={() => { setMode("create"); setError(null); }}
            className="flex-1 py-2 rounded-[10px] font-display text-[13px] tracking-wide transition-colors"
            style={{
              background: mode === "create" ? "#1C2B33" : "#EDEAE1",
              color: mode === "create" ? "#F7F4ED" : "#1C2B33",
            }}
          >
            CRÉER UN GROUPE
          </button>
        </div>

        {mode === "join" ? (
          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                Code du groupe
              </label>
              <input
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                placeholder="ex : EIB-7F3K"
                required
                className="w-full px-3.5 py-3 rounded-[10px] font-display text-[15px] tracking-wide outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
            </div>
            <div>
              <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                Ton prénom
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex : Mika"
                required
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
            </div>
            <div>
              <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                Ton code à 4 chiffres
              </label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                inputMode="numeric"
                className="w-full px-3.5 py-3 rounded-[10px] font-display text-[18px] tracking-[0.3em] text-center outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
              <p className="text-[12px] opacity-55 mt-1.5">
                Si c'est ta première connexion, laisse vide — il sera créé automatiquement.
              </p>
            </div>
            {error && (
              <p className="text-[13px] rounded-[10px] px-3 py-2" style={{ background: "#FBE5E1", color: "#E8543E" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-[12px] font-display text-[14px] tracking-wide disabled:opacity-50"
              style={{ background: "#3F8755", color: "#F7F4ED" }}
            >
              {loading ? "CONNEXION…" : "REJOINDRE"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                Nom du groupe
              </label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="ex : EIB"
                required
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
              <p className="text-[12px] opacity-55 mt-1.5">
                Le nom de ton école, quartier ou groupe d'échange.
              </p>
            </div>
            <div>
              <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                Ton prénom
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex : Boyeon"
                required
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
            </div>
            <div>
              <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                Ton code à 4 chiffres
              </label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                inputMode="numeric"
                className="w-full px-3.5 py-3 rounded-[10px] font-display text-[18px] tracking-[0.3em] text-center outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
              <p className="text-[12px] opacity-55 mt-1.5">
                Si c'est ta première connexion, laisse vide — il sera créé automatiquement.
              </p>
            </div>
            {error && (
              <p className="text-[13px] rounded-[10px] px-3 py-2" style={{ background: "#FBE5E1", color: "#E8543E" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-[12px] font-display text-[14px] tracking-wide disabled:opacity-50"
              style={{ background: "#E8543E", color: "#F7F4ED" }}
            >
              {loading ? "CRÉATION…" : "CRÉER LE GROUPE"}
            </button>
            {createdCode && (
              <div className="rounded-[12px] p-3 text-center" style={{ background: "#EDEAE1" }}>
                <p className="text-[12px] opacity-70 mb-1">Code à partager avec le groupe :</p>
                <p className="font-display text-[20px] tracking-widest" style={{ color: "#1C2B33" }}>
                  {createdCode}
                </p>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
