import type { LiveCandidate, LivePost } from "@/lib/types";
import { postIsDeclared, rankByVotesThenName, resolveSeats, shortPostName } from "@/lib/utils";

export type PanelStanding = {
  name: string;
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

export function panelKey(name: string | null | undefined) {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "Independent";
}

export function panelTheme(name: string | null | undefined): PanelTheme {
  const key = panelKey(name).toUpperCase();
  if (key.includes("SFI")) return { bg: "#be123c", fg: "#fff1f2", bar: "#fb7185", ring: "#fda4af" };
  if (key.includes("KSU")) return { bg: "#ca8a04", fg: "#111827", bar: "#facc15", ring: "#fde047" };
  if (key.includes("ABVP")) return { bg: "#c2410c", fg: "#fff7ed", bar: "#fb923c", ring: "#fdba74" };
  if (key.includes("INDEPENDENT") || key === "IND") {
    return { bg: "#0369a1", fg: "#f0f9ff", bar: "#38bdf8", ring: "#7dd3fc" };
  }
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
    const created = { name: key, votes: 0, won: 0, lead: 0, tie: 0, tally: 0 };
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
      bucket(candidate.panel_name).votes += candidate.votes;
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
    .sort((a, b) => b.tally - a.tally || b.won - a.won || b.votes - a.votes || a.name.localeCompare(b.name, "en"));
}

export function postRaceStatus(post: LivePost) {
  const ranked = rankByVotesThenName(
    post.candidates ?? [],
    (candidate) => candidate.votes,
    (candidate) => candidate.name,
  );
  const { elected, tied } = resolveSeats(ranked, post.seats, (candidate) => candidate.votes);
  const declared = postIsDeclared(post);
  const leaders = declared ? [...elected, ...tied] : [...elected, ...tied];
  const headline = leaders[0] ?? ranked[0] ?? null;
  const hasVotes = (ranked[0]?.votes ?? 0) > 0;

  if (!hasVotes) {
    return { label: "COUNTING" as const, leaders: [] as LiveCandidate[], ranked, elected, tied, declared };
  }
  if (declared && tied.length && elected.length === 0) {
    return { label: "TIE" as const, leaders: tied, ranked, elected, tied, declared };
  }
  if (declared) {
    return { label: "WON" as const, leaders, ranked, elected, tied, declared };
  }
  return { label: "LEAD" as const, leaders, ranked, elected, tied, declared };
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
  status: "WON" | "TIE" | "LEAD";
};

export type TickerItem = {
  post: string;
  label: "WON" | "TIE" | "LEAD" | "COUNTING";
  people: TickerPerson[];
};

export function raceTickerItems(posts: LivePost[]): TickerItem[] {
  return posts.flatMap((post) => {
    const race = postRaceStatus(post);
    if (!race.declared) return [];
    const people: TickerPerson[] = [
      ...race.elected.map((candidate) => ({
        name: candidate.name,
        photo_url: candidate.photo_url,
        panel: panelKey(candidate.panel_name),
        status: "WON" as const,
      })),
      ...race.tied.map((candidate) => ({
        name: candidate.name,
        photo_url: candidate.photo_url,
        panel: panelKey(candidate.panel_name),
        status: "TIE" as const,
      })),
    ];
    return [
      {
        post: shortPostName(post.name),
        label: race.label,
        people,
      },
    ];
  });
}
