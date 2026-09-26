"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LiveCounter } from "@/components/results/live-counter";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme, postRaceStatus } from "@/lib/results-studio";
import type { LiveCandidate, LivePost } from "@/lib/types";
import {
  cn,
  competitionRank,
  initials,
  percent,
  postIsDeclared,
  rankByVotesThenName,
} from "@/lib/utils";

const POST_MS = 3400;
const PEOPLE_MS = 2200;
const BARS_MS = 1600;
export const LATEST_REVEAL_MS = POST_MS + PEOPLE_MS + BARS_MS;

type Phase = "post" | "people" | "bars" | "rank";

function postCountSignature(post: LivePost) {
  const candidateVotes = (post.candidates ?? []).map((candidate) => `${candidate.id}:${candidate.votes}`).join(",");
  return `${post.verified_rounds}:${post.pending_rounds}:${post.total_verified_votes}:${post.invalid_votes}:${candidateVotes}`;
}

function postActivity(post: LivePost) {
  return (post.candidates ?? []).reduce((sum, candidate) => sum + candidate.votes, 0) + (post.invalid_votes ?? 0);
}

function rankedIds(post: LivePost) {
  return rankByVotesThenName(post.candidates ?? [], (candidate) => candidate.votes, (candidate) => candidate.name).map(
    (candidate) => candidate.id,
  );
}

function orderCandidates(candidates: LiveCandidate[], ids: string[] | null) {
  if (!ids?.length) {
    return rankByVotesThenName(candidates, (candidate) => candidate.votes, (candidate) => candidate.name);
  }
  const index = new Map(ids.map((id, order) => [id, order]));
  return [...candidates].sort((a, b) => {
    const aIndex = index.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = index.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.name.localeCompare(b.name, "en");
  });
}

export function useLatestCountUpdate(posts: LivePost[]) {
  const prevSigRef = useRef(new Map<string, string>());
  const prevRankRef = useRef(new Map<string, string[]>());
  const [id, setId] = useState<string | null>(null);
  const [holdOrder, setHoldOrder] = useState<string[] | null>(null);

  useEffect(() => {
    const signatures = new Map(posts.map((post) => [post.id, postCountSignature(post)]));
    const changed = posts.filter((post) => {
      const previous = prevSigRef.current.get(post.id);
      return previous !== undefined && previous !== signatures.get(post.id);
    });

    if (changed.length) {
      const newest = [...changed].sort((a, b) => postActivity(b) - postActivity(a) || a.name.localeCompare(b.name, "en"));
      setId(newest[0].id);
      setHoldOrder(prevRankRef.current.get(newest[0].id) ?? null);
    } else if (!id) {
      const withCounts = posts.filter((post) => postActivity(post) > 0);
      const pick =
        withCounts.find((post) => !postIsDeclared(post)) ??
        withCounts[withCounts.length - 1] ??
        null;
      if (pick) {
        setId(pick.id);
        setHoldOrder(null);
      }
    } else if (!posts.some((post) => post.id === id)) {
      setId(null);
      setHoldOrder(null);
    }

    prevSigRef.current = signatures;
    for (const post of posts) {
      prevRankRef.current.set(post.id, rankedIds(post));
    }
  }, [posts, id]);

  return { post: posts.find((post) => post.id === id) ?? null, holdOrder };
}

export function LatestResult({ post, holdOrder }: { post: LivePost | null; holdOrder?: string[] | null }) {
  const [phase, setPhase] = useState<Phase>("post");
  const signature = post ? postCountSignature(post) : "";

  useEffect(() => {
    if (!post) return;
    setPhase("post");
    const people = window.setTimeout(() => setPhase("people"), POST_MS);
    const bars = window.setTimeout(() => setPhase("bars"), POST_MS + PEOPLE_MS);
    const rank = window.setTimeout(() => setPhase("rank"), POST_MS + PEOPLE_MS + BARS_MS);
    return () => {
      window.clearTimeout(people);
      window.clearTimeout(bars);
      window.clearTimeout(rank);
    };
  }, [post?.id, signature]);

  if (!post) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <LatestHeader />
        <p className="flex flex-1 items-center justify-center px-6 text-center text-sm font-black uppercase tracking-[0.22em] text-slate-400">
          Awaiting first count
        </p>
      </section>
    );
  }

  const race = postRaceStatus(post);
  const ranked = rankByVotesThenName(
    post.candidates ?? [],
    (candidate) => candidate.votes,
    (candidate) => candidate.name,
  );
  const intro = orderCandidates(post.candidates ?? [], holdOrder ?? null);
  const rows = phase === "rank" ? ranked : intro;
  const maxVotes = ranked[0]?.votes ?? 0;
  const candidateVotes = ranked.reduce((sum, candidate) => sum + candidate.votes, 0);
  const showPeople = phase !== "post";
  const showBars = phase === "bars" || phase === "rank";
  const showRank = phase === "rank";
  const remainingSeats = Math.max(0, post.seats - race.elected.length);
  const headline = race.declared
    ? race.tied.length && !race.elected.length
      ? "TIE"
      : post.seats > 1
        ? "ELECTED"
        : "WINS"
    : race.hasVotes
      ? "LEADING"
      : "COUNTING";
  const leaderIds = new Set(race.elected.map((candidate) => candidate.id));
  const tiedIds = new Set(race.tied.map((candidate) => candidate.id));

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <LatestHeader />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <AnimatePresence>
          {phase === "post" ? (
            <motion.div
              key={`spotlight-${post.id}-${signature}`}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950 px-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              <motion.p
                className="text-[11px] font-black tracking-[0.42em] text-red-400"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: [0.35, 1, 0.45, 1], y: 0 }}
                transition={{ duration: 2.6, repeat: Infinity, repeatType: "mirror" }}
              >
                LATEST UPDATE
              </motion.p>
              <motion.h2
                className="mt-4 max-w-4xl text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
                initial={{ opacity: 0.25, scale: 0.94, filter: "blur(8px)" }}
                animate={{
                  opacity: [0.35, 1, 0.55, 1],
                  scale: [0.96, 1.03, 1],
                  filter: ["blur(8px)", "blur(0px)", "blur(2px)", "blur(0px)"],
                }}
                transition={{ duration: 2.8, ease: "easeInOut" }}
              >
                {post.name}
              </motion.h2>
              <motion.p
                className="mt-5 text-xs font-bold uppercase tracking-[0.28em] text-slate-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0.35, 0.9] }}
                transition={{ duration: 2.4, delay: 0.4, repeat: Infinity, repeatType: "mirror" }}
              >
                {post.seats} seat{post.seats > 1 ? "s" : ""} · result incoming
              </motion.p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex shrink-0 items-end justify-between gap-4 border-b border-slate-100 px-5 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.28em] text-slate-400">POST</p>
            <h2 className="mt-0.5 text-xl font-black uppercase leading-tight tracking-tight text-slate-950 sm:text-3xl">
              {post.name}
            </h2>
          </div>
          <AnimatePresence>
            {showRank ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="shrink-0 text-right"
              >
                <span className="inline-block rounded-sm bg-slate-900 px-2 py-1 text-[11px] font-black tracking-[0.2em] text-white">
                  {headline}
                </span>
                {race.tied.length > 0 ? (
                  <p className="mt-1 text-[10px] font-black tracking-[0.16em] text-slate-500">
                    TIE FOR {remainingSeats || post.seats} SEAT{remainingSeats === 1 ? "" : "S"}
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!showPeople ? (
            <div className="h-full" />
          ) : rows.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm font-black uppercase tracking-[0.22em] text-slate-400">
              No candidates on this post
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((person, index) => {
                const badge = leaderIds.has(person.id)
                  ? race.declared
                    ? "WON"
                    : "LEAD"
                  : tiedIds.has(person.id)
                    ? "TIE"
                    : "TRAIL";
                return (
                  <RevealRow
                    key={person.id}
                    person={person}
                    rank={competitionRank(ranked, ranked.findIndex((row) => row.id === person.id), (item) => item.votes)}
                    index={index}
                    badge={badge}
                    maxVotes={maxVotes}
                    share={percent(person.votes, candidateVotes)}
                    showBars={showBars}
                    showRank={showRank}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LatestHeader() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 bg-red-600 px-4 py-2 text-white">
      <span className="size-2 shrink-0 rounded-full bg-white" style={{ animation: "livePulse 1.4s ease-out infinite" }} />
      <p className="text-[11px] font-black tracking-[0.28em]">LATEST UPDATE</p>
    </div>
  );
}

function RevealRow({
  person,
  rank,
  index,
  badge,
  maxVotes,
  share,
  showBars,
  showRank,
}: {
  person: LiveCandidate;
  rank: number;
  index: number;
  badge: "WON" | "TIE" | "LEAD" | "TRAIL";
  maxVotes: number;
  share: number;
  showBars: boolean;
  showRank: boolean;
}) {
  const theme = panelTheme(person.panel_name, person.panel_color);
  const panel = panelKey(person.panel_name);
  const classLabel = candidateClassLabel(person.branch, person.year, person.semester);
  const width = maxVotes > 0 ? (person.votes / maxVotes) * 100 : 0;
  const won = badge === "WON";
  const lead = badge === "LEAD";
  const tied = badge === "TIE";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        layout: { type: "spring", stiffness: 70, damping: 18 },
        delay: showRank ? 0 : index * 0.08,
        duration: 0.45,
      }}
      className={cn(
        "flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:gap-4 sm:px-6",
        showRank && won ? "border-l-4 border-l-slate-900 bg-slate-50" : showRank && tied ? "border-l-4 border-l-slate-300" : "bg-white",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-sm font-black tabular-nums text-slate-600">
        {showRank && maxVotes > 0 ? rank : "–"}
      </span>
      {person.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo_url}
          alt=""
          className={cn(
            "size-14 shrink-0 rounded-full object-cover ring-2 sm:size-16",
            showRank && (won || lead) ? "ring-slate-900" : "ring-slate-200",
          )}
        />
      ) : (
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-black ring-2 sm:size-16",
            showRank && (won || lead) ? "ring-slate-900" : "ring-slate-200",
          )}
          style={{ background: theme.bg, color: theme.fg }}
        >
          {initials(person.name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-2xl">{person.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
            style={{ background: theme.bg, color: theme.fg }}
          >
            {panel}
          </span>
          {classLabel ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{classLabel}</span>
          ) : null}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-slate-800"
            initial={{ width: 0 }}
            animate={{ width: showBars ? `${width}%` : 0 }}
            transition={{ type: "spring", stiffness: 55, damping: 18 }}
          />
        </div>
      </div>
      {showRank && badge !== "TRAIL" ? (
        <span
          className={cn(
            "hidden shrink-0 rounded-sm border px-2 py-1 text-[11px] font-black tracking-[0.14em] sm:inline",
            won || lead ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 text-slate-600",
          )}
        >
          {badge}
        </span>
      ) : null}
      <div className={cn("w-16 shrink-0 text-right sm:w-24", showBars ? "opacity-100" : "opacity-0")}>
        <LiveCounter value={showBars ? person.votes : 0} className="block text-2xl font-black tabular-nums leading-none text-slate-950 sm:text-4xl" />
        <p className="mt-0.5 text-[10px] font-bold tabular-nums text-slate-500">{showBars ? `${share}%` : ""}</p>
      </div>
    </motion.article>
  );
}
