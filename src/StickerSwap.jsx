import React, { useState, useMemo, useCallback } from "react";

/* ----------------------------------------------------------------
   StickerSwap — prototype interactif
   Échange de stickers/cartes à collectionner (Panini & autres)
   entre voisins / parents d'école, en main propre ou par courrier.
------------------------------------------------------------------- */

// ---------- Données de référence (collection FIFA World Cup 2026, format réel observé) ----------

const GROUPS = [
  { code: "A", teams: [
    { code: "MEX", name: "Mexique", flag: "🇲🇽" },
    { code: "RSA", name: "Afrique du Sud", flag: "🇿🇦" },
    { code: "KOR", name: "Corée du Sud", flag: "🇰🇷" },
    { code: "CZE", name: "Tchéquie", flag: "🇨🇿" },
  ]},
  { code: "B", teams: [
    { code: "SUI", name: "Suisse", flag: "🇨🇭" },
    { code: "CAN", name: "Canada", flag: "🇨🇦" },
    { code: "BIH", name: "Bosnie-Herz.", flag: "🇧🇦" },
    { code: "QAT", name: "Qatar", flag: "🇶🇦" },
  ]},
  { code: "C", teams: [
    { code: "BRA", name: "Brésil", flag: "🇧🇷" },
    { code: "MAR", name: "Maroc", flag: "🇲🇦" },
    { code: "SCO", name: "Écosse", flag: "🏴" },
    { code: "HAI", name: "Haïti", flag: "🇭🇹" },
  ]},
  { code: "D", teams: [
    { code: "USA", name: "USA", flag: "🇺🇸" },
    { code: "AUS", name: "Australie", flag: "🇦🇺" },
    { code: "PAR", name: "Paraguay", flag: "🇵🇾" },
    { code: "TUR", name: "Türkiye", flag: "🇹🇷" },
  ]},
  { code: "E", teams: [
    { code: "GER", name: "Allemagne", flag: "🇩🇪" },
    { code: "CIV", name: "Côte d'Ivoire", flag: "🇨🇮" },
    { code: "ECU", name: "Équateur", flag: "🇪🇨" },
    { code: "CUW", name: "Curaçao", flag: "🇨🇼" },
  ]},
  { code: "F", teams: [
    { code: "NED", name: "Pays-Bas", flag: "🇳🇱" },
    { code: "JPN", name: "Japon", flag: "🇯🇵" },
    { code: "SWE", name: "Suède", flag: "🇸🇪" },
    { code: "TUN", name: "Tunisie", flag: "🇹🇳" },
  ]},
  { code: "G", teams: [
    { code: "BEL", name: "Belgique", flag: "🇧🇪" },
    { code: "EGY", name: "Égypte", flag: "🇪🇬" },
    { code: "IRN", name: "Iran", flag: "🇮🇷" },
    { code: "NZL", name: "Nouvelle-Zélande", flag: "🇳🇿" },
  ]},
  { code: "H", teams: [
    { code: "ESP", name: "Espagne", flag: "🇪🇸" },
    { code: "CPV", name: "Cap-Vert", flag: "🇨🇻" },
    { code: "URU", name: "Uruguay", flag: "🇺🇾" },
    { code: "KSA", name: "Arabie Saoudite", flag: "🇸🇦" },
  ]},
  { code: "I", teams: [
    { code: "FRA", name: "France", flag: "🇫🇷" },
    { code: "NOR", name: "Norvège", flag: "🇳🇴" },
    { code: "SEN", name: "Sénégal", flag: "🇸🇳" },
    { code: "IRQ", name: "Irak", flag: "🇮🇶" },
  ]},
  { code: "J", teams: [
    { code: "ARG", name: "Argentine", flag: "🇦🇷" },
    { code: "AUT", name: "Autriche", flag: "🇦🇹" },
    { code: "ALG", name: "Algérie", flag: "🇩🇿" },
    { code: "JOR", name: "Jordanie", flag: "🇯🇴" },
  ]},
  { code: "K", teams: [
    { code: "COL", name: "Colombie", flag: "🇨🇴" },
    { code: "POR", name: "Portugal", flag: "🇵🇹" },
    { code: "COD", name: "RD Congo", flag: "🇨🇩" },
    { code: "UZB", name: "Ouzbékistan", flag: "🇺🇿" },
  ]},
  { code: "L", teams: [
    { code: "ENG", name: "Angleterre", flag: "🏴" },
    { code: "GHA", name: "Ghana", flag: "🇬🇭" },
    { code: "CRO", name: "Croatie", flag: "🇭🇷" },
    { code: "PAN", name: "Panama", flag: "🇵🇦" },
  ]},
];

// Catégories spéciales hors équipes nationales : logo officiel de la Coupe du Monde (FWC)
// et série Coca-Cola, chacune avec son propre nombre de vignettes (différent des 20 par équipe).
const SPECIAL_CATEGORIES = [
  { code: "FWC", name: "FIFA World Cup (logo)", flag: "🏆", count: 19 },
  { code: "CC", name: "Coca-Cola", flag: "🥤", count: 12 },
];

const NUMS_PER_TEAM = 20; // 20 vignettes numérotées par équipe dans l'album officiel

// Génère le pool complet de stickers à partir des équipes, plus les catégories spéciales (FWC, Coca-Cola)
function buildStickerPool() {
  const pool = [];
  GROUPS.forEach((g) => {
    g.teams.forEach((t) => {
      for (let n = 1; n <= NUMS_PER_TEAM; n++) {
        pool.push({
          id: `${t.code}${n}`,
          team: t.code,
          teamName: t.name,
          flag: t.flag,
          group: g.code,
          num: n,
          special: n === NUMS_PER_TEAM, // dernière case = "spéciale" (effet doré)
        });
      }
    });
  });
  SPECIAL_CATEGORIES.forEach((cat) => {
    for (let n = 1; n <= cat.count; n++) {
      pool.push({
        id: `${cat.code}${n}`,
        team: cat.code,
        teamName: cat.name,
        flag: cat.flag,
        group: "SP",
        num: n,
        special: n === cat.count,
      });
    }
  });
  return pool;
}

const STICKER_POOL = buildStickerPool();
const STICKER_BY_ID = Object.fromEntries(STICKER_POOL.map((s) => [s.id, s]));

// Affichage lisible d'un identifiant de vignette : "MEX2" -> "MEX 2"
function formatStickerLabel(id) {
  const s = STICKER_BY_ID[id];
  return s ? `${s.team} ${s.num}` : id;
}

const COLLECTION = { id: "fwc2026", name: "FIFA World Cup 2026", brand: "Panini" };

// ---------- Voisins fictifs avec inventaires plausibles (issus de la dynamique réelle observée) ----------

const NEIGHBORS = [
  { id: "u1", name: "Mika", avatar: "🟣", group: "EIB", distance: "180 m" },
  { id: "u2", name: "Leila", avatar: "🟡", group: "EIB", distance: "350 m" },
  { id: "u3", name: "Gabriel (D.)", avatar: "🟢", group: "EIB", distance: "2 km (poste)" },
  { id: "u4", name: "Arthur", avatar: "🔵", group: "EIB", distance: "600 m" },
  { id: "u5", name: "Nathanaël", avatar: "🟠", group: "EIB", distance: "750 m" },
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildNeighborInventory(seed) {
  const rnd = seededRandom(seed);
  const doubles = {};
  const needs = {};
  STICKER_POOL.forEach((s) => {
    const r = rnd();
    if (r < 0.22) doubles[s.id] = 1 + Math.floor(rnd() * 3);
    else if (r < 0.5) needs[s.id] = true;
  });
  return { doubles, needs };
}

const NEIGHBOR_INVENTORIES = Object.fromEntries(
  NEIGHBORS.map((n, i) => [n.id, buildNeighborInventory(42 + i * 17)])
);

// ---------- État initial "moi" : quelques doubles et besoins de départ, cohérent avec le chat ----------

function buildInitialMine() {
  const rnd = seededRandom(7);
  const doubles = {};
  const needs = {};
  STICKER_POOL.forEach((s) => {
    const r = rnd();
    if (r < 0.18) doubles[s.id] = 1 + Math.floor(rnd() * 3);
    else if (r < 0.4) needs[s.id] = true;
  });
  return { doubles, needs };
}

// ---------- Composant Vignette (le signature element : recto/verso façon vraie carte Panini) ----------

function StickerCard({ sticker, mode, qty, onClick, selected, size = "md" }) {
  // mode: "have" (double, à colorier façon recto), "need" (case vide pointillée), "none"
  const dims = size === "sm" ? "w-[58px] h-[78px]" : "w-[76px] h-[102px]";
  const isSpecial = sticker.special;

  const base =
    "relative rounded-[6px] select-none transition-transform duration-150 ease-out cursor-pointer " +
    dims;

  if (mode === "have") {
    return (
      <button
        onClick={onClick}
        className={`${base} group ${selected ? "scale-[1.06]" : "hover:scale-[1.04]"}`}
        style={{
          background: isSpecial
            ? "linear-gradient(135deg, #C9A24B 0%, #E8D08A 45%, #C9A24B 100%)"
            : "#1C2B33",
          boxShadow: selected
            ? "0 0 0 3px #3F8755, 0 6px 14px rgba(0,0,0,0.35)"
            : "0 3px 8px rgba(0,0,0,0.28)",
        }}
        aria-pressed={selected}
        aria-label={`${sticker.teamName} ${sticker.num}, en double, ${qty} exemplaire${qty > 1 ? "s" : ""}`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
          <span className="text-[20px] leading-none mb-1">{sticker.flag}</span>
          <span
            className="font-display tracking-wide text-[13px] leading-none"
            style={{ color: isSpecial ? "#1C2B33" : "#F7F4ED" }}
          >
            {sticker.team}
          </span>
          <span
            className="font-display text-[18px] leading-none mt-0.5"
            style={{ color: isSpecial ? "#1C2B33" : "#F7F4ED" }}
          >
            {sticker.num}
          </span>
        </div>
        {qty > 1 && (
          <span
            className="absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
            style={{ background: "#E8543E", color: "#F7F4ED" }}
          >
            ×{qty}
          </span>
        )}
      </button>
    );
  }

  if (mode === "need") {
    return (
      <button
        onClick={onClick}
        className={`${base} border-2 border-dashed flex flex-col items-center justify-center ${
          selected ? "scale-[1.06]" : "hover:scale-[1.04]"
        }`}
        style={{
          borderColor: selected ? "#3F8755" : "#C8CDD1",
          background: "rgba(200,205,209,0.12)",
        }}
        aria-pressed={selected}
        aria-label={`${sticker.teamName} ${sticker.num}, manquant`}
      >
        <span className="text-[16px] opacity-50 mb-1">{sticker.flag}</span>
        <span className="font-display text-[11px] tracking-wide opacity-50" style={{ color: "#1C2B33" }}>
          {sticker.team}
        </span>
        <span className="font-display text-[15px] opacity-50" style={{ color: "#1C2B33" }}>
          {sticker.num}
        </span>
      </button>
    );
  }

  // mode "none": case grise neutre (ni double ni besoin: déjà collée en 1 exemplaire)
  return (
    <button
      onClick={onClick}
      className={`${base} flex flex-col items-center justify-center opacity-40 hover:opacity-70`}
      style={{ background: "#E4E1D8", border: "1px solid #C8CDD1" }}
      aria-label={`${sticker.teamName} ${sticker.num}, possédé en un seul exemplaire`}
    >
      <span className="text-[14px]">{sticker.flag}</span>
      <span className="font-display text-[10px]" style={{ color: "#1C2B33" }}>
        {sticker.team} {sticker.num}
      </span>
    </button>
  );
}

// ---------- Onglet de groupe (façon "Groupe A / B / C / D" du carnet, + onglet "Spéciales") ----------

// Liste combinée pour les onglets : groupes de foot A-L, puis le groupe spécial à la fin.
const ALL_TABS = [...GROUPS, { code: "SP", teams: SPECIAL_CATEGORIES, isSpecial: true }];

function GroupTabs({ activeGroup, setActiveGroup }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {ALL_TABS.map((g) => (
        <button
          key={g.code}
          onClick={() => setActiveGroup(g.code)}
          className="shrink-0 px-3.5 py-1.5 rounded-full font-display text-[13px] tracking-wide transition-colors"
          style={{
            background: activeGroup === g.code ? "#1C2B33" : "transparent",
            color: activeGroup === g.code ? "#F7F4ED" : "#1C2B33",
            border: "1.5px solid #1C2B33",
          }}
        >
          {g.isSpecial ? "SPÉCIALES" : `GROUPE ${g.code}`}
        </button>
      ))}
    </div>
  );
}

// ---------- Vue Inventaire (onglet principal : mes doubles + mes besoins) ----------

export function InventoryView({ mine, setMine, activeGroup, setActiveGroup }) {
  const [tab, setTab] = useState("doubles"); // doubles | needs

  const activeTab = ALL_TABS.find((g) => g.code === activeGroup);
  const teams = activeTab.teams;

  const toggleHave = useCallback(
    (id) => {
      setMine((prev) => {
        const doubles = { ...prev.doubles };
        const needs = { ...prev.needs };
        delete needs[id];
        if (doubles[id]) {
          doubles[id] = doubles[id] >= 4 ? undefined : doubles[id] + 1;
          if (!doubles[id]) delete doubles[id];
        } else {
          doubles[id] = 1;
        }
        return { doubles, needs };
      });
    },
    [setMine]
  );

  const toggleNeed = useCallback(
    (id) => {
      setMine((prev) => {
        const needs = { ...prev.needs };
        const doubles = { ...prev.doubles };
        if (doubles[id]) return prev; // ne peut pas être besoin si déjà en double
        if (needs[id]) delete needs[id];
        else needs[id] = true;
        return { doubles, needs };
      });
    },
    [setMine]
  );

  const stats = useMemo(() => {
    const dCount = Object.values(mine.doubles).reduce((a, b) => a + b, 0);
    const nCount = Object.keys(mine.needs).length;
    const distinctDoubles = Object.keys(mine.doubles).length;
    return { dCount, nCount, distinctDoubles };
  }, [mine]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="font-display text-[22px] tracking-wide" style={{ color: "#1C2B33" }}>
            MON CARNET
          </h2>
          <p className="text-[13px] opacity-60 mt-0.5">{COLLECTION.name} · {COLLECTION.brand}</p>
        </div>
        <div className="flex gap-3 text-right">
          <div>
            <div className="font-display text-[20px]" style={{ color: "#3F8755" }}>{stats.dCount}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-60">doubles</div>
          </div>
          <div>
            <div className="font-display text-[20px]" style={{ color: "#E8543E" }}>{stats.nCount}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-60">besoins</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("doubles")}
          className="flex-1 py-2 rounded-[10px] font-display text-[13px] tracking-wide transition-colors"
          style={{
            background: tab === "doubles" ? "#1C2B33" : "#EDEAE1",
            color: tab === "doubles" ? "#F7F4ED" : "#1C2B33",
          }}
        >
          MES DOUBLES À ÉCHANGER
        </button>
        <button
          onClick={() => setTab("needs")}
          className="flex-1 py-2 rounded-[10px] font-display text-[13px] tracking-wide transition-colors"
          style={{
            background: tab === "needs" ? "#E8543E" : "#EDEAE1",
            color: tab === "needs" ? "#F7F4ED" : "#1C2B33",
          }}
        >
          CE QUI ME MANQUE
        </button>
      </div>

      <GroupTabs activeGroup={activeGroup} setActiveGroup={setActiveGroup} />

      <p className="text-[12px] opacity-55 mt-3 mb-2 leading-snug">
        {tab === "doubles"
          ? "Touche une vignette pour ajouter un double (jusqu'à ×4). Re-touche pour augmenter, puis retirer."
          : "Touche une case vide pour signaler qu'elle te manque."}
      </p>

      {teams.map((t) => {
        const stickerCount = t.count || NUMS_PER_TEAM;
        return (
        <div key={t.code} className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[15px]">{t.flag}</span>
            <span className="font-display text-[13px] tracking-wide" style={{ color: "#1C2B33" }}>
              {t.name.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: stickerCount }, (_, i) => i + 1).map((n) => {
              const id = `${t.code}${n}`;
              const sticker = STICKER_BY_ID[id];
              const hasDouble = mine.doubles[id];
              const isNeed = mine.needs[id];

              if (tab === "doubles") {
                return (
                  <StickerCard
                    key={id}
                    sticker={sticker}
                    mode={hasDouble ? "have" : "none"}
                    qty={hasDouble || 0}
                    onClick={() => toggleHave(id)}
                    size="sm"
                  />
                );
              }
              return (
                <StickerCard
                  key={id}
                  sticker={sticker}
                  mode={isNeed ? "need" : hasDouble ? "have" : "none"}
                  qty={hasDouble || 0}
                  onClick={() => !hasDouble && toggleNeed(id)}
                  size="sm"
                  selected={isNeed}
                />
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ---------- Calcul du matching : pour chaque voisin, intersection bidirectionnelle ----------

function computeMatch(mine, theirInv) {
  const iCanGive = []; // mes doubles qui correspondent à leurs besoins
  const theyCanGive = []; // leurs doubles qui correspondent à mes besoins

  Object.keys(mine.doubles).forEach((id) => {
    if (theirInv.needs[id]) iCanGive.push(id);
  });
  Object.keys(theirInv.doubles).forEach((id) => {
    if (mine.needs[id]) theyCanGive.push(id);
  });

  return { iCanGive, theyCanGive, score: Math.min(iCanGive.length, theyCanGive.length), total: iCanGive.length + theyCanGive.length };
}

// ---------- Vue Matching (l'app propose les meilleurs échanges) ----------

export function MatchingView({ mine, neighbors, groupName, onOpenProposal }) {
  const matches = useMemo(() => {
    return neighbors
      .map((n) => {
        const m = computeMatch(mine, n.inventory);
        return { neighbor: n, ...m };
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => b.score - a.score || b.total - a.total);
  }, [mine, neighbors]);

  if (neighbors.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-[16px] mb-1" style={{ color: "#1C2B33" }}>
          Personne d'autre dans ce groupe pour l'instant
        </p>
        <p className="text-[13px] opacity-60 max-w-xs mx-auto">
          Partage le code du groupe avec d'autres parents pour que les suggestions d'échange apparaissent ici.
        </p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-[16px] mb-1" style={{ color: "#1C2B33" }}>
          Aucun match pour l'instant
        </p>
        <p className="text-[13px] opacity-60 max-w-xs mx-auto">
          Ajoute des doubles et des besoins dans ton carnet pour que l'app puisse te proposer des échanges avec le quartier.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-[22px] tracking-wide mb-1" style={{ color: "#1C2B33" }}>
        SUGGESTIONS D'ÉCHANGE
      </h2>
      <p className="text-[13px] opacity-60 mb-4">
        Classées par échange le plus équilibré, groupe "{groupName}"
      </p>

      <div className="space-y-3">
        {matches.map(({ neighbor, iCanGive, theyCanGive, score }) => (
          <div
            key={neighbor.id}
            className="rounded-[14px] p-4"
            style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(28,43,51,0.12)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-display"
                  style={{ background: "#EDEAE1", color: "#1C2B33" }}
                >
                  {neighbor.avatar || neighbor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-display text-[14px] tracking-wide" style={{ color: "#1C2B33" }}>
                    {neighbor.name.toUpperCase()}
                  </div>
                  <div className="text-[11px] opacity-55">{neighbor.group || groupName}{neighbor.distance ? ` · ${neighbor.distance}` : ""}</div>
                </div>
              </div>
              {score >= 3 && (
                <span
                  className="text-[10px] font-display tracking-wide px-2 py-1 rounded-full"
                  style={{ background: "#3F8755", color: "#F7F4ED" }}
                >
                  ÉCHANGE FORT
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide opacity-55 mb-1.5">
                  Tu peux lui donner ({iCanGive.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {iCanGive.slice(0, 6).map((id) => (
                    <span
                      key={id}
                      className="font-display text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: "#1C2B33", color: "#F7F4ED" }}
                    >
                      {formatStickerLabel(id)}
                    </span>
                  ))}
                  {iCanGive.length > 6 && (
                    <span className="text-[11px] opacity-55 px-1">+{iCanGive.length - 6}</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide opacity-55 mb-1.5">
                  Il/elle peut te donner ({theyCanGive.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {theyCanGive.slice(0, 6).map((id) => (
                    <span
                      key={id}
                      className="font-display text-[11px] px-1.5 py-0.5 rounded border"
                      style={{ borderColor: "#E8543E", color: "#E8543E" }}
                    >
                      {formatStickerLabel(id)}
                    </span>
                  ))}
                  {theyCanGive.length > 6 && (
                    <span className="text-[11px] opacity-55 px-1">+{theyCanGive.length - 6}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenProposal(neighbor, iCanGive, theyCanGive)}
              className="w-full py-2 rounded-[10px] font-display text-[13px] tracking-wide"
              style={{ background: "#E8543E", color: "#F7F4ED" }}
            >
              PROPOSER UN ÉCHANGE
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Modale de proposition d'échange ----------

export function ProposalModal({ proposal, onClose, onSend }) {
  const { neighbor, iCanGive, theyCanGive } = proposal;
  const [selectedGive, setSelectedGive] = useState(() => new Set(iCanGive.slice(0, 3)));
  const [selectedGet, setSelectedGet] = useState(() => new Set(theyCanGive.slice(0, 3)));
  const [method, setMethod] = useState("main propre");

  const toggle = (set, setSet, id) => {
    setSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(28,43,51,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-[20px] sm:rounded-[20px] p-5 max-h-[88vh] overflow-y-auto"
        style={{ background: "#F7F4ED" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-[18px] tracking-wide" style={{ color: "#1C2B33" }}>
            ÉCHANGE AVEC {neighbor.name.toUpperCase()}
          </h3>
          <button onClick={onClose} className="text-[20px] opacity-50 px-2">×</button>
        </div>

        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wide opacity-55 mb-2">
            Tu donnes — touche pour sélectionner
          </div>
          <div className="flex flex-wrap gap-2">
            {iCanGive.map((id) => {
              const s = STICKER_BY_ID[id];
              const sel = selectedGive.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggle(selectedGive, setSelectedGive, id)}
                  className="font-display text-[12px] px-2.5 py-1.5 rounded-[8px] flex items-center gap-1"
                  style={{
                    background: sel ? "#1C2B33" : "#EDEAE1",
                    color: sel ? "#F7F4ED" : "#1C2B33",
                  }}
                >
                  <span>{s.flag}</span> {formatStickerLabel(id)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-wide opacity-55 mb-2">
            Tu reçois — touche pour sélectionner
          </div>
          <div className="flex flex-wrap gap-2">
            {theyCanGive.map((id) => {
              const s = STICKER_BY_ID[id];
              const sel = selectedGet.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggle(selectedGet, setSelectedGet, id)}
                  className="font-display text-[12px] px-2.5 py-1.5 rounded-[8px] flex items-center gap-1 border"
                  style={{
                    background: sel ? "#E8543E" : "transparent",
                    color: sel ? "#F7F4ED" : "#E8543E",
                    borderColor: "#E8543E",
                  }}
                >
                  <span>{s.flag}</span> {formatStickerLabel(id)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-wide opacity-55 mb-2">Mode d'échange</div>
          <div className="flex gap-2">
            {["main propre", "par la poste"].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className="flex-1 py-2 rounded-[10px] text-[13px] capitalize"
                style={{
                  background: method === m ? "#1C2B33" : "#EDEAE1",
                  color: method === m ? "#F7F4ED" : "#1C2B33",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div
          className="rounded-[12px] p-3 mb-4 text-[12px] leading-relaxed"
          style={{ background: "#EDEAE1", color: "#1C2B33" }}
        >
          {selectedGive.size} contre {selectedGet.size} ·{" "}
          {selectedGive.size === selectedGet.size ? (
            <span style={{ color: "#3F8755" }}>échange équilibré</span>
          ) : (
            <span style={{ color: "#E8543E" }}>échange déséquilibré</span>
          )}
          <br />
          <span className="opacity-70">
            Tes vignettes seront réservées dès l'envoi pour qu'elles ne soient pas promises ailleurs. Tu pourras annuler à tout moment depuis l'onglet Échanges.
          </span>
        </div>

        <button
          onClick={() => onSend(method, [...selectedGive], [...selectedGet])}
          disabled={selectedGive.size === 0 || selectedGet.size === 0}
          className="w-full py-3 rounded-[12px] font-display text-[14px] tracking-wide disabled:opacity-40"
          style={{ background: "#3F8755", color: "#F7F4ED" }}
        >
          ENVOYER LA DEMANDE
        </button>
      </div>
    </div>
  );
}

// ---------- Modale de confirmation : mettre à jour le carnet quand un échange est terminé ----------

export function CompleteTradeModal({ trade, onClose, onConfirm }) {
  const alreadyDone = trade.status === "done";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(28,43,51,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-[20px] sm:rounded-[20px] p-5"
        style={{ background: "#F7F4ED" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[18px] tracking-wide mb-3" style={{ color: "#1C2B33" }}>
          {alreadyDone ? "MISE À JOUR DU CARNET" : "ÉCHANGE RÉALISÉ"} AVEC {trade.neighbor.name.toUpperCase()}
        </h3>

        <div className="flex flex-wrap gap-1.5 items-center mb-4">
          {trade.give.map((id) => (
            <span key={id} className="font-display text-[11px] px-1.5 py-0.5 rounded" style={{ background: "#1C2B33", color: "#F7F4ED" }}>
              {formatStickerLabel(id)}
            </span>
          ))}
          <span className="text-[12px] opacity-50 px-1">→</span>
          {trade.get.map((id) => (
            <span key={id} className="font-display text-[11px] px-1.5 py-0.5 rounded border" style={{ borderColor: "#E8543E", color: "#E8543E" }}>
              {formatStickerLabel(id)}
            </span>
          ))}
        </div>

        <p className="text-[13px] opacity-70 mb-5 leading-relaxed">
          Veux-tu que je mette à jour ton carnet automatiquement avec le résultat de cet échange ? Les vignettes données seront retirées de tes doubles, et celles reçues y seront ajoutées.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => onConfirm(trade, true)}
            className="w-full py-3 rounded-[12px] font-display text-[14px] tracking-wide"
            style={{ background: "#3F8755", color: "#F7F4ED" }}
          >
            OUI, METTRE À JOUR AUTOMATIQUEMENT
          </button>
          <button
            onClick={() => onConfirm(trade, false)}
            className="w-full py-3 rounded-[12px] font-display text-[14px] tracking-wide"
            style={{ background: "#EDEAE1", color: "#1C2B33" }}
          >
            NON, JE M'EN OCCUPE MOI-MÊME
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Vue Échanges en cours ----------

export function TradesView({ trades, onUpdateStatus, onCancel, onRequestComplete, myPersonId, ChatComponent }) {
  const [openChatId, setOpenChatId] = useState(null);

  if (trades.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-[16px] mb-1" style={{ color: "#1C2B33" }}>
          Pas encore d'échange en cours
        </p>
        <p className="text-[13px] opacity-60 max-w-xs mx-auto">
          Va dans "Suggestions" pour proposer un échange à un voisin du quartier.
        </p>
      </div>
    );
  }

  const statusLabel = { pending: "En attente", accepted: "Accepté · à réaliser", done: "Terminé" };
  const statusColor = { pending: "#E8543E", accepted: "#3F8755", done: "#1C2B33" };

  return (
    <div>
      <h2 className="font-display text-[22px] tracking-wide mb-4" style={{ color: "#1C2B33" }}>
        MES ÉCHANGES
      </h2>
      <div className="space-y-3">
        {trades.map((t) => (
          <div
            key={t.id}
            className="rounded-[14px] p-4"
            style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(28,43,51,0.12)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-[14px] tracking-wide" style={{ color: "#1C2B33" }}>
                {t.neighbor.name.toUpperCase()}
              </div>
              <span
                className="text-[10px] font-display tracking-wide px-2 py-1 rounded-full"
                style={{ background: statusColor[t.status], color: "#F7F4ED" }}
              >
                {statusLabel[t.status].toUpperCase()}
              </span>
            </div>
            <div className="text-[12px] opacity-70 mb-2">
              {t.give.length} vignette{t.give.length > 1 ? "s" : ""} données ↔ {t.get.length} reçue{t.get.length > 1 ? "s" : ""} · {t.method}
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {t.give.map((id) => (
                <span key={id} className="font-display text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#1C2B33", color: "#F7F4ED" }}>
                  {formatStickerLabel(id)}
                </span>
              ))}
              <span className="text-[12px] opacity-50 px-1">→</span>
              {t.get.map((id) => (
                <span key={id} className="font-display text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: "#E8543E", color: "#E8543E" }}>
                  {formatStickerLabel(id)}
                </span>
              ))}
            </div>
            {t.status === "pending" && (
              <button
                onClick={() => onUpdateStatus(t.id, "accepted")}
                className="w-full py-1.5 rounded-[8px] text-[12px] mb-2"
                style={{ background: "#EDEAE1", color: "#1C2B33" }}
              >
                Marquer comme accepté par l'autre
              </button>
            )}
            {t.status === "accepted" && (
              <button
                onClick={() => onRequestComplete(t)}
                className="w-full py-1.5 rounded-[8px] text-[12px] mb-2"
                style={{ background: "#EDEAE1", color: "#1C2B33" }}
              >
                Marquer comme réalisé
              </button>
            )}
            {t.status === "done" && !t.inventoryApplied && (
              <button
                onClick={() => onRequestComplete(t)}
                className="w-full py-1.5 rounded-[8px] text-[12px] mb-2"
                style={{ background: "#EDEAE1", color: "#1C2B33" }}
              >
                Mettre à jour mon carnet avec ce résultat
              </button>
            )}
            {t.status !== "done" && (
              <button
                onClick={() => onCancel(t.id)}
                className="w-full py-1.5 rounded-[8px] text-[12px] flex items-center justify-center gap-1.5"
                style={{ background: "transparent", color: "#E8543E", border: "1px solid #E8543E" }}
              >
                <span aria-hidden="true">↺</span> Annuler et libérer mes vignettes
              </button>
            )}
            {ChatComponent && (
              <>
                <button
                  onClick={() => setOpenChatId((prev) => (prev === t.id ? null : t.id))}
                  className="w-full py-1.5 rounded-[8px] text-[12px] flex items-center justify-center gap-1.5 mt-2"
                  style={{ background: "#EDEAE1", color: "#1C2B33" }}
                >
                  <span aria-hidden="true">💬</span>
                  {openChatId === t.id ? "Fermer la discussion" : "Discuter de cet échange"}
                </button>
                {openChatId === t.id && <ChatComponent tradeId={t.id} myPersonId={myPersonId} />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- App racine ----------

export default function StickerSwapApp() {
  const [mine, setMine] = useState(buildInitialMine);
  const [activeGroup, setActiveGroup] = useState("A");
  const [screen, setScreen] = useState("inventory"); // inventory | matching | trades
  const [proposal, setProposal] = useState(null);
  const [trades, setTrades] = useState([]);
  const [toast, setToast] = useState(null);

  const handleSend = (method, give, get) => {
    const newTrade = {
      id: `t${Date.now()}`,
      neighbor: proposal.neighbor,
      give,
      get,
      method,
      status: "pending",
    };
    setTrades((prev) => [newTrade, ...prev]);

    // Réserve les vignettes données : on les retire des doubles disponibles pour éviter le double-engagement
    setMine((prev) => {
      const doubles = { ...prev.doubles };
      give.forEach((id) => {
        if (doubles[id] > 1) doubles[id] -= 1;
        else delete doubles[id];
      });
      const needs = { ...prev.needs };
      get.forEach((id) => delete needs[id]);
      return { doubles, needs };
    });

    setProposal(null);
    setToast(`Demande envoyée à ${proposal.neighbor.name} · vignettes réservées`);
    setTimeout(() => setToast(null), 3200);
    setScreen("trades");
  };

  const handleCancel = (tradeId) => {
    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    // Libère les vignettes données (elles redeviennent disponibles dans mes doubles)
    // et remet les vignettes qu'on devait recevoir dans mes besoins, puisque l'échange n'a pas eu lieu.
    setMine((prev) => {
      const doubles = { ...prev.doubles };
      trade.give.forEach((id) => {
        doubles[id] = (doubles[id] || 0) + 1;
      });
      const needs = { ...prev.needs };
      trade.get.forEach((id) => {
        if (!doubles[id]) needs[id] = true;
      });
      return { doubles, needs };
    });

    setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    setToast(`Échange avec ${trade.neighbor.name} annulé · vignettes libérées`);
    setTimeout(() => setToast(null), 3200);
  };

  const navItems = [
    { id: "inventory", label: "Carnet" },
    { id: "matching", label: "Suggestions" },
    { id: "trades", label: "Échanges", badge: trades.filter((t) => t.status === "pending").length },
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

      {/* Header */}
      <div
        className="px-5 pt-6 pb-3 sticky top-0 z-10"
        style={{ background: "#F7F4ED", borderBottom: "1px solid #E4E1D8" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-7 h-9 rounded-[3px] flex items-center justify-center font-display text-[11px]"
            style={{ background: "#1C2B33", color: "#F7F4ED", transform: "rotate(-4deg)" }}
          >
            26
          </div>
          <span className="font-display text-[19px] tracking-wide" style={{ color: "#1C2B33" }}>
            STICKERSWAP
          </span>
        </div>
      </div>

      {/* Contenu */}
      <div className="px-5 py-4 max-w-md mx-auto pb-24">
        {screen === "inventory" && (
          <InventoryView mine={mine} setMine={setMine} activeGroup={activeGroup} setActiveGroup={setActiveGroup} />
        )}
        {screen === "matching" && (
          <MatchingView
            mine={mine}
            onOpenProposal={(neighbor, iCanGive, theyCanGive) =>
              setProposal({ neighbor, iCanGive, theyCanGive })
            }
          />
        )}
        {screen === "trades" && (
          <TradesView
            trades={trades}
            onUpdateStatus={(id, status) =>
              setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
            }
            onCancel={handleCancel}
          />
        )}
      </div>

      {/* Bottom nav */}
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

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-[10px] text-[13px] z-50 max-w-[85%] text-center"
          style={{ background: "#1C2B33", color: "#F7F4ED" }}
        >
          {toast}
        </div>
      )}

      {/* Modale proposition */}
      {proposal && (
        <ProposalModal proposal={proposal} onClose={() => setProposal(null)} onSend={handleSend} />
      )}
    </div>
  );
}
