"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LiveCounter } from "@/components/results/live-counter";
import { WinnerBurst, winnerBurstMs } from "@/components/results/winner-burst";
import { useHallListScroll } from "@/hooks/use-hall-list-scroll";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme, postRaceStatus } from "@/lib/results-studio";
import type { LiveCandidate, LivePost } from "@/lib/types";
import {
  cn,
  competitionRank,
  formatNumber,
  initials,
  liveCountedBallots,
  ordinalMark,
  percent,
  postIsDeclared,
  rankByVotesThenName,
} from "@/lib/utils";

const POST_MS = 3000;
const PEOPLE_MS = 2000;
const BARS_MS = 5200;
const RANK_MS = 1400;
const COLOR_MS = 900;
export const LATEST_REVEAL_MS = POST_MS + PEOPLE_MS + BARS_MS + RANK_MS + COLOR_MS;
const BAR_FILL = { duration: 4.8, ease: [0.12, 0.72, 0.18, 1] as const };

export function latestHoldMs(post: LivePost | null) {
  if (!post) return LATEST_REVEAL_MS;
  const crowd = post.candidates?.length ?? 0;
  const scrollExtra = crowd >= 3 ? 4000 : 0;
  if (!postIsDeclared(post)) return LATEST_REVEAL_MS + scrollExtra;
  const race = postRaceStatus(post);
  return LATEST_REVEAL_MS + winnerBurstMs(race.elected.length + race.tied.length) + scrollExtra;
}

type Phase = "post" | "people" | "bars" | "rank" | "color";

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
    return [...candidates].sort((a, b) => a.name.localeCompare(b.name, "en"));
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
  const [burstReady, setBurstReady] = useState(false);
  const signature = post ? postCountSignature(post) : "";
  const candidateCount = post?.candidates?.length ?? 0;
  const compact = candidateCount >= 3;
  const dense = candidateCount >= 4;
  const listRef = useHallListScroll(
    post ? `${post.id}:${signature}` : "idle",
    1600,
    Boolean(post) && (phase === "rank" || phase === "color"),
  );

  useEffect(() => {
    if (!post) return;
    setPhase("post");
    const people = window.setTimeout(() => setPhase("people"), POST_MS);
    const bars = window.setTimeout(() => setPhase("bars"), POST_MS + PEOPLE_MS);
    const rank = window.setTimeout(() => setPhase("rank"), POST_MS + PEOPLE_MS + BARS_MS);
    const color = window.setTimeout(() => setPhase("color"), POST_MS + PEOPLE_MS + BARS_MS + RANK_MS);
    return () => {
      window.clearTimeout(people);
      window.clearTimeout(bars);
      window.clearTimeout(rank);
      window.clearTimeout(color);
    };
  }, [post?.id, signature]);

  useEffect(() => {
    setBurstReady(false);
    if (!post || phase !== "color") return;
    const timer = window.setTimeout(() => setBurstReady(true), 500);
    return () => window.clearTimeout(timer);
  }, [phase, post?.id, signature]);

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

  const countedBallots = liveCountedBallots(post);
  const votesPolled = post.votes_polled ?? 0;
  const race = postRaceStatus(post);
  const ranked = rankByVotesThenName(
    post.candidates ?? [],
    (candidate) => candidate.votes,
    (candidate) => candidate.name,
  );
  const intro = orderCandidates(post.candidates ?? [], holdOrder ?? null);
  const rows = phase === "rank" || phase === "color" ? ranked : intro;
  const maxVotes = ranked[0]?.votes ?? 0;
  const candidateVotes = ranked.reduce((sum, candidate) => sum + candidate.votes, 0);
  const invalidVotes = post.invalid_votes ?? 0;
  const countedMarks = candidateVotes + invalidVotes;
  const invalidSlots =
    post.invalid_slot_votes && post.invalid_slot_votes.length > 1 ? post.invalid_slot_votes : null;
  const showPeople = phase !== "post";
  const showValues = phase === "bars" || phase === "rank" || phase === "color";
  const showColor = phase === "color";
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
      <LatestHeader counted={countedBallots} polled={votesPolled} />
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
                {post.seats} seat{post.seats > 1 ? "s" : ""}
                {" · "}
                {formatNumber(countedBallots)} counted
                {votesPolled > 0 ? ` · ${formatNumber(votesPolled)} polled` : ""}
              </motion.p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className={cn("flex shrink-0 items-end justify-between gap-4 border-b border-slate-100 px-4 sm:px-5", dense ? "py-1.5" : compact ? "py-2" : "py-3")}>
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.28em] text-slate-400">POST</p>
            <h2
              className={cn(
                "mt-0.5 font-black uppercase leading-tight tracking-tight text-slate-950",
                dense ? "text-base sm:text-xl" : compact ? "text-lg sm:text-2xl" : "text-xl sm:text-3xl",
              )}
            >
              {post.name}
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {formatNumber(countedBallots)} counted
              {votesPolled > 0 ? ` · ${formatNumber(votesPolled)} polled` : ""}
            </p>
          </div>
          <AnimatePresence>
            {showColor ? (
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

        <div
          ref={listRef}
          data-hall-scroll="latest"
          className="h-0 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
                    share={percent(person.votes, countedMarks)}
                    showValues={showValues}
                    showColor={showColor}
                    compact={compact}
                    dense={dense}
                  />
                );
              })}
              {showValues && invalidSlots
                ? invalidSlots.some((votes) => votes > 0)
                  ? invalidSlots.map((votes, slot) => (
                      <InvalidRevealRow
                        key={`invalid-${slot}`}
                        label={`Invalid ${ordinalMark(slot)}`}
                        votes={votes}
                        maxVotes={Math.max(maxVotes, ...invalidSlots)}
                        share={percent(votes, countedMarks)}
                        showValues={showValues}
                        showColor={showColor}
                        compact={compact}
                        dense={dense}
                      />
                    ))
                  : null
                : showValues && invalidVotes > 0
                  ? (
                      <InvalidRevealRow
                        votes={invalidVotes}
                        maxVotes={Math.max(maxVotes, invalidVotes)}
                        share={percent(invalidVotes, countedMarks)}
                        showValues={showValues}
                        showColor={showColor}
                        compact={compact}
                        dense={dense}
                      />
                    )
                  : null}
            </div>
          )}
        </div>
      </div>
      {showColor && burstReady && race.declared && (race.elected.length > 0 || race.tied.length > 0) ? (
        <WinnerBurst
          postId={`${post.id}:${signature}`}
          postName={post.name}
          winners={race.elected}
          tied={race.tied}
          seats={post.seats}
        />
      ) : null}
    </section>
  );
}

function LatestHeader({ counted, polled }: { counted?: number; polled?: number }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 bg-red-600 px-4 py-2 text-white">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full bg-white" style={{ animation: "livePulse 1.4s ease-out infinite" }} />
        <p className="text-[11px] font-black tracking-[0.28em]">LATEST UPDATE</p>
      </span>
      {counted != null ? (
        <p className="ml-auto text-[11px] font-black tabular-nums tracking-[0.14em]">
          {formatNumber(counted)} COUNTED
          {polled != null && polled > 0 ? ` · ${formatNumber(polled)} POLLED` : ""}
        </p>
      ) : null}
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
  showValues,
  showColor,
  compact,
  dense,
}: {
  person: LiveCandidate;
  rank: number;
  index: number;
  badge: "WON" | "TIE" | "LEAD" | "TRAIL";
  maxVotes: number;
  share: number;
  showValues: boolean;
  showColor: boolean;
  compact: boolean;
  dense: boolean;
}) {
  const theme = panelTheme(person.panel_name, person.panel_color);
  const panel = panelKey(person.panel_name);
  const classLabel = candidateClassLabel(person.branch, person.year, person.semester);
  const width = maxVotes > 0 ? (person.votes / maxVotes) * 100 : 0;
  const won = badge === "WON";
  const lead = badge === "LEAD";
  const tied = badge === "TIE";
  const photo = dense ? "size-8" : compact ? "size-10" : "size-14 sm:size-16";
  const barScale = showValues ? width / 100 : 0;
  const barClass =
    showColor && (won || lead)
      ? "bg-slate-900"
      : showColor && tied
        ? "bg-slate-500"
        : "bg-slate-300";

  return (
    <motion.article
      layout="position"
      layoutId={`latest-row-${person.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        layout: { duration: 0.95, ease: [0.22, 1, 0.32, 1] },
        opacity: { delay: showValues ? 0 : index * 0.05, duration: 0.35 },
        y: { delay: showValues ? 0 : index * 0.05, duration: 0.35 },
      }}
      className={cn(
        "flex items-center border-b border-slate-100",
        dense ? "gap-2 px-3 py-0.5 sm:px-4" : compact ? "gap-2 px-4 py-1 sm:px-5" : "gap-3 px-4 py-3 sm:gap-4 sm:px-6",
        showColor && won ? "border-l-4 border-l-slate-900 bg-slate-50" : showColor && tied ? "border-l-4 border-l-slate-300" : "bg-white",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-sm bg-slate-100 font-black tabular-nums text-slate-600",
          dense ? "size-6 text-[11px]" : compact ? "size-7 text-xs" : "size-9 text-sm",
        )}
      >
        {showColor && maxVotes > 0 ? rank : "–"}
      </span>
      {person.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo_url}
          alt=""
          className={cn(
            "shrink-0 rounded-full object-cover ring-2",
            photo,
            showColor && (won || lead) ? "ring-slate-900" : "ring-slate-200",
            showColor ? "" : "grayscale",
          )}
        />
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full font-black ring-2",
            photo,
            dense ? "text-[11px]" : compact ? "text-xs" : "text-lg",
            showColor && (won || lead) ? "ring-slate-900" : "ring-slate-200",
          )}
          style={showColor ? { background: theme.bg, color: theme.fg } : { background: "#e2e8f0", color: "#475569" }}
        >
          {initials(person.name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p
            className={cn(
              "truncate font-black leading-tight tracking-tight text-slate-950",
              dense ? "text-sm sm:text-base" : compact ? "text-base sm:text-lg" : "text-lg sm:text-2xl",
            )}
          >
            {person.name}
          </p>
          {showColor && badge !== "TRAIL" ? (
            <span
              className={cn(
                "hidden shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] sm:inline",
                won || lead ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 text-slate-600",
              )}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <div className={cn("flex flex-wrap items-center gap-1.5", dense ? "mt-0" : "mt-0.5")}>
          {showColor ? (
            <span
              className="rounded-sm px-1 py-px text-[9px] font-black uppercase tracking-wide"
              style={{ background: theme.bg, color: theme.fg }}
            >
              {panel}
            </span>
          ) : (
            <span className="rounded-sm bg-slate-200 px-1 py-px text-[9px] font-black uppercase tracking-wide text-slate-500">
              ···
            </span>
          )}
          {classLabel && !compact && showColor ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{classLabel}</span>
          ) : null}
        </div>
        <div className={cn("origin-left overflow-hidden rounded-full bg-slate-100", dense ? "mt-0.5 h-1" : compact ? "mt-1 h-1" : "mt-2 h-2")}>
          <motion.div
            className={cn("h-full w-full origin-left rounded-full", barClass)}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: barScale }}
            transition={showValues ? BAR_FILL : { duration: 0.3 }}
          />
        </div>
      </div>
      <div className={cn("shrink-0 text-right", dense ? "w-12 sm:w-16" : compact ? "w-14 sm:w-20" : "w-16 sm:w-24", showValues ? "opacity-100" : "opacity-0")}>
        <LiveCounter
          value={showValues ? person.votes : 0}
          slow
          className={cn(
            "block font-black tabular-nums leading-none text-slate-950",
            dense ? "text-lg sm:text-xl" : compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-4xl",
          )}
        />
        <p className="text-[10px] font-bold leading-none tabular-nums text-slate-500">{showValues ? `${share}%` : ""}</p>
      </div>
    </motion.article>
  );
}

function InvalidRevealRow({
  votes,
  maxVotes,
  share,
  label = "Invalid",
  showValues,
  showColor,
  compact,
  dense,
}: {
  votes: number;
  maxVotes: number;
  share: number;
  label?: string;
  showValues: boolean;
  showColor: boolean;
  compact: boolean;
  dense: boolean;
}) {
  const width = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
  const barScale = showValues ? width / 100 : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center border-t",
        showColor ? "border-red-100 bg-red-50" : "border-slate-100 bg-white",
        dense ? "gap-2 px-3 py-0.5 sm:px-4" : compact ? "gap-2 px-4 py-1 sm:px-5" : "gap-3 px-4 py-3 sm:gap-4 sm:px-6",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-sm font-black",
          dense ? "size-6 text-[8px]" : compact ? "size-7 text-[9px]" : "size-9 text-[10px]",
          showColor ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500",
        )}
      >
        INV
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-black leading-tight tracking-tight",
            showColor ? "text-red-900" : "text-slate-700",
            dense ? "text-sm sm:text-base" : compact ? "text-base sm:text-lg" : "text-lg sm:text-2xl",
          )}
        >
          {label}
        </p>
        <div className={cn("origin-left overflow-hidden rounded-full", showColor ? "bg-red-100" : "bg-slate-100", dense ? "mt-0.5 h-1" : compact ? "mt-1 h-1" : "mt-2 h-2")}>
          <motion.div
            className={cn("h-full w-full origin-left rounded-full", showColor ? "bg-red-400" : "bg-slate-300")}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: barScale }}
            transition={BAR_FILL}
          />
        </div>
      </div>
      <div className={cn("shrink-0 text-right", dense ? "w-12 sm:w-16" : compact ? "w-14 sm:w-20" : "w-16 sm:w-24", showValues ? "opacity-100" : "opacity-0")}>
        <LiveCounter
          value={showValues ? votes : 0}
          slow
          className={cn(
            "block font-black tabular-nums leading-none",
            showColor ? "text-red-700" : "text-slate-950",
            dense ? "text-lg sm:text-xl" : compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-4xl",
          )}
        />
        <p className={cn("text-[10px] font-bold leading-none tabular-nums", showColor ? "text-red-600" : "text-slate-500")}>
          {showValues ? `${share}%` : ""}
        </p>
      </div>
    </motion.article>
  );
}
