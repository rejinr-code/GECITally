import type { LiveCandidate, LivePost } from "@/lib/types";
import { postIsDeclared, rankByVotesThenName, resolveSeats, shortPostName } from "@/lib/utils";

export type PanelStanding = {
  name: string;
  color: string | null;
  votes: number;
  won: number;
  lead: number;
  tie: number;
  tally: number;
};

export type PanelTheme = {
  bg: string;
  fg: string;
  bar: string;
  ring: string;
};

const FALLBACK_THEMES: PanelTheme[] = [
  { bg: "#0f766e", fg: "#ecfeff", bar: "#2dd4bf", ring: "#5eead4" },
  { bg: "#7c3aed", fg: "#f5f3ff", bar: "#a78bfa", ring: "#c4b5fd" },
  { bg: "#c2410c", fg: "#fff7ed", bar: "#fb923c", ring: "#fdba74" },
  { bg: "#1d4ed8", fg: "#eff6ff", bar: "#60a5fa", ring: "#93c5fd" },
];

const INDEPENDENT_THEME: PanelTheme = {
  bg: "#3f3f46",
  fg: "#f8fafc",
  bar: "#a1a1aa",
  ring: "#d4d4d8",
};

export function isIndependentPanel(name: string | null | undefined) {
  const key = panelKey(name).toUpperCase();
  return key.includes("INDEPENDENT") || key === "IND";
}

export function parsePanelColor(value: string | null | undefined) {
  const hex = value?.trim() ?? "";
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

function mixHex(hex: string, toward: number, amount: number) {
  const mix = (part: string) => {
    const value = Number.parseInt(part, 16);
    return Math.round(value + (toward - value) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(hex.slice(1, 3))}${mix(hex.slice(3, 5))}${mix(hex.slice(5, 7))}`;
}

export function themeFromColor(hex: string): PanelTheme {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return {
    bg: hex,
    fg: luminance > 0.62 ? "#111827" : "#fff7ed",
    bar: mixHex(hex, 255, 0.38),
    ring: mixHex(hex, 255, 0.55),
  };
}

export function panelKey(name: string | null | undefined) {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "Independent";
}

export function panelTheme(name: string | null | undefined, color?: string | null): PanelTheme {
  if (isIndependentPanel(name)) return INDEPENDENT_THEME;
  const parsed = parsePanelColor(color);
  if (parsed) return themeFromColor(parsed);
  const key = panelKey(name).toUpperCase();
  if (key.includes("SFI")) return { bg: "#be123c", fg: "#fff1f2", bar: "#fb7185", ring: "#fda4af" };
  if (key.includes("KSU")) return { bg: "#ca8a04", fg: "#111827", bar: "#facc15", ring: "#fde047" };
  if (key.includes("ABVP")) return { bg: "#c2410c", fg: "#fff7ed", bar: "#fb923c", ring: "#fdba74" };
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_THEMES[hash % FALLBACK_THEMES.length];
}

export function summarizePanels(posts: LivePost[]): PanelStanding[] {
  const map = new Map<string, PanelStanding>();
  function bucket(name: string | null | undefined) {
    const key = panelKey(name);
    const current = map.get(key);
    if (current) return current;
    const created = { name: key, color: null as string | null, votes: 0, won: 0, lead: 0, tie: 0, tally: 0 };
    map.set(key, created);
    return created;
  }

  for (const post of posts) {
    const ranked = rankByVotesThenName(
      post.candidates ?? [],
      (candidate) => candidate.votes,
      (candidate) => candidate.name,
    );
    const { elected, tied } = resolveSeats(ranked, post.seats, (candidate) => candidate.votes);
    const declared = postIsDeclared(post);
    for (const candidate of ranked) {
      const standing = bucket(candidate.panel_name);
      standing.votes += candidate.votes;
      if (!standing.color && candidate.panel_color) standing.color = candidate.panel_color;
    }
    if (declared) {
      for (const candidate of elected) bucket(candidate.panel_name).won += 1;
      for (const candidate of tied) bucket(candidate.panel_name).tie += 1;
    } else {
      for (const candidate of elected) bucket(candidate.panel_name).lead += 1;
      for (const candidate of tied) bucket(candidate.panel_name).tie += 1;
    }
  }

  return [...map.values()]
    .map((panel) => ({ ...panel, tally: panel.won + panel.lead }))
    .sort((a, b) => {
      const aIndependent = isIndependentPanel(a.name);
      const bIndependent = isIndependentPanel(b.name);
      if (aIndependent !== bIndependent) return aIndependent ? 1 : -1;
      return b.tally - a.tally || b.won - a.won || b.votes - a.votes || a.name.localeCompare(b.name, "en");
    });
}

export function postRaceStatus(post: LivePost) {
  const ranked = rankByVotesThenName(
    post.candidates ?? [],
    (candidate) => candidate.votes,
    (candidate) => candidate.name,
  );
  const { elected, tied } = resolveSeats(ranked, post.seats, (candidate) => candidate.votes);
  const declared = postIsDeclared(post);
  const hasVotes = (ranked[0]?.votes ?? 0) > 0;

  if (!hasVotes) {
    return {
      label: "COUNTING" as const,
      leaders: [] as LiveCandidate[],
      trailers: [] as LiveCandidate[],
      ranked,
      elected,
      tied,
      declared,
      hasVotes,
    };
  }
  const leaderIds = new Set([...elected, ...tied].map((candidate) => candidate.id));
  const trailers = ranked.filter((candidate) => !leaderIds.has(candidate.id) && candidate.votes > 0);
  if (declared && tied.length && elected.length === 0) {
    return { label: "TIE" as const, leaders: tied, trailers, ranked, elected, tied, declared, hasVotes };
  }
  if (declared) {
    return { label: "WON" as const, leaders: [...elected, ...tied], trailers, ranked, elected, tied, declared, hasVotes };
  }
  return { label: "LEAD" as const, leaders: [...elected, ...tied], trailers, ranked, elected, tied, declared, hasVotes };
}

export function summarizeSeatRace(posts: LivePost[]) {
  let totalSeats = 0;
  let won = 0;
  let tiedSeats = 0;
  let leading = 0;
  let declaredPosts = 0;

  for (const post of posts) {
    const seats = Math.max(1, post.seats ?? 1);
    totalSeats += seats;
    const race = postRaceStatus(post);
    if (race.declared) {
      declaredPosts += 1;
      won += race.elected.length;
      tiedSeats += Math.max(0, seats - race.elected.length);
    } else {
      leading += race.elected.length;
    }
  }

  return {
    totalSeats,
    won,
    tiedSeats,
    leading,
    declaredPosts,
    postCount: posts.length,
    remaining: Math.max(0, totalSeats - won - tiedSeats),
  };
}

export type TickerPerson = {
  name: string;
  photo_url: string | null;
  panel: string;
  color: string | null;
  votes: number;
  status: "WON" | "TIE" | "LEAD" | "TRAIL";
};

export type TickerItem = {
  post: string;
  label: "WON" | "TIE" | "LEAD" | "COUNTING";
  people: TickerPerson[];
};

function tickerPerson(candidate: LiveCandidate, status: TickerPerson["status"]): TickerPerson {
  return {
    name: candidate.name,
    photo_url: candidate.photo_url,
    panel: panelKey(candidate.panel_name),
    color: candidate.panel_color ?? null,
    votes: candidate.votes,
    status,
  };
}

export function raceTickerItems(posts: LivePost[]): TickerItem[] {
  return posts.flatMap((post) => {
    const race = postRaceStatus(post);
    if (!race.hasVotes) return [];
    const people: TickerPerson[] = race.declared
      ? [
          ...race.elected.map((candidate) => tickerPerson(candidate, "WON")),
          ...race.tied.map((candidate) => tickerPerson(candidate, "TIE")),
        ]
      : [
          ...race.elected.map((candidate) => tickerPerson(candidate, "LEAD")),
          ...race.tied.map((candidate) => tickerPerson(candidate, "TIE")),
          ...race.trailers.map((candidate) => tickerPerson(candidate, "TRAIL")),
        ];
    if (!people.length) return [];
    return [
      {
        post: shortPostName(post.name),
        label: race.label,
        people,
      },
    ];
  });
}
