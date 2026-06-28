import React, { useState } from "react";
import { createGroup, joinGroup } from "./auth.js";

export default function JoinScreen({ onJoined }) {
  const [mode, setMode] = useState("join"); // join | create
  const [groupCode, setGroupCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [needsPin, setNeedsPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdCode, setCreatedCode] = useState(null);
  const [revealedPin, setRevealedPin] = useState(null);

  const resetNameRelatedState = () => {
    setNeedsPin(false);
    setPin("");
    setError(null);
  };

  const performJoin = async (code, name, pinValue) => {
    try {
      const { session, generatedPin } = await joinGroup(code, name, pinValue || undefined);
      if (generatedPin) {
        // Nouvelle personne : on affiche son PIN une seule fois avant de continuer,
        // pour qu'elle puisse le noter avant de l'oublier.
        setRevealedPin({ pin: generatedPin, session });
      } else {
        onJoined(session);
      }
    } catch (err) {
      if (err.code === "NAME_TAKEN_NEEDS_PIN") {
        setNeedsPin(true);
        setError("Ce prénom est déjà utilisé sur PaniniSwap. Si c'est toi (sur un autre appareil), entre ton code à 4 chiffres ci-dessous.");
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
      await performJoin(group.code, displayName.trim(), needsPin ? pin : null);
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
      await performJoin(groupCode.trim(), displayName.trim(), needsPin ? pin : null);
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
            Voici ton code personnel à 4 chiffres. Note-le quelque part — il te servira si tu utilises PaniniSwap depuis un autre téléphone ou ordinateur un jour.
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
            onClick={() => { setMode("join"); resetNameRelatedState(); }}
            className="flex-1 py-2 rounded-[10px] font-display text-[13px] tracking-wide transition-colors"
            style={{
              background: mode === "join" ? "#1C2B33" : "#EDEAE1",
              color: mode === "join" ? "#F7F4ED" : "#1C2B33",
            }}
          >
            REJOINDRE UN GROUPE
          </button>
          <button
            onClick={() => { setMode("create"); resetNameRelatedState(); }}
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
              <p className="text-[12px] opacity-55 mt-1.5">
                Demande ce code à la personne qui t'a invité (comme un lien d'invitation WhatsApp).
              </p>
            </div>
            <div>
              <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                Ton prénom
              </label>
              <input
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); resetNameRelatedState(); }}
                placeholder="ex : Mika"
                required
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
              <p className="text-[12px] opacity-55 mt-1.5">
                Chaque prénom n'existe qu'une fois sur PaniniSwap. Si le tien est pris, essaie une variante (ex : Arthur K, Arthur2).
              </p>
            </div>
            {needsPin && (
              <div>
                <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                  Ton code à 4 chiffres
                </label>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  inputMode="numeric"
                  required
                  className="w-full px-3.5 py-3 rounded-[10px] font-display text-[18px] tracking-[0.3em] text-center outline-none"
                  style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
                />
              </div>
            )}
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
                onChange={(e) => { setDisplayName(e.target.value); resetNameRelatedState(); }}
                placeholder="ex : Boyeon"
                required
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] outline-none"
                style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
              />
              <p className="text-[12px] opacity-55 mt-1.5">
                Chaque prénom n'existe qu'une fois sur PaniniSwap. Si le tien est pris, essaie une variante.
              </p>
            </div>
            {needsPin && (
              <div>
                <label className="text-[12px] uppercase tracking-wide opacity-55 block mb-1.5">
                  Ton code à 4 chiffres
                </label>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  inputMode="numeric"
                  required
                  className="w-full px-3.5 py-3 rounded-[10px] font-display text-[18px] tracking-[0.3em] text-center outline-none"
                  style={{ background: "#FFFFFF", border: "1.5px solid #C8CDD1", color: "#1C2B33" }}
                />
              </div>
            )}
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
