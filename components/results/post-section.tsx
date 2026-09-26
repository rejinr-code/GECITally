"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CandidateCard } from "@/components/results/candidate-card";
import { LiveCounter } from "@/components/results/live-counter";
import { WINNER_BURST_MS, WinnerBurst } from "@/components/results/winner-burst";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme } from "@/lib/results-studio";
import type { LiveCandidate, LivePost } from "@/lib/types";
import {
  competitionRank,
  formatNumber,
  initials,
  liveCountedBallots,
  ordinalMark,
  percent,
  postIsDeclared,
  rankByVotesThenName,
  resolveSeats,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PostSection({
  post,
  flashKey,
  serial,
  requireVerification,
  compact = false,
}: {
  post: LivePost;
  flashKey: number;
  serial: number;
  requireVerification: boolean;
  compact?: boolean;
}) {
  const ranked = rankByVotesThenName(post.candidates ?? [], (candidate) => candidate.votes, (candidate) => candidate.name);
  const maxVotes = ranked[0]?.votes ?? 0;
  const invalidVotes = post.invalid_votes ?? 0;
  const invalidSlots =
    post.invalid_slot_votes && post.invalid_slot_votes.length > 1 ? post.invalid_slot_votes : null;
  const candidateVotes = ranked.reduce((sum, candidate) => sum + candidate.votes, 0);
  const countedMarks = candidateVotes + invalidVotes;
  const countedBallots = liveCountedBallots(post);
  const votesPolled = post.votes_polled ?? 0;
  const declared = postIsDeclared(post);
  const { elected, tied } = resolveSeats(ranked, post.seats, (candidate) => candidate.votes);
  const winners = declared ? elected : [];
  const tiedDeclared = declared ? tied : [];
  const leadingIds = new Set([...elected, ...tied].map((candidate) => candidate.id));
  const portraits = declared ? [...winners, ...tiedDeclared] : [...elected, ...tied].filter((candidate) => candidate.votes > 0);
  const statusLabel = declared
    ? tiedDeclared.length && !winners.length
      ? "TIE"
      : post.seats > 1
        ? "ELECTED"
        : "WINS"
    : maxVotes > 0
      ? "LEADING"
      : "COUNTING";
  const listRef = useHallListScroll(
    post.id,
    declared && (winners.length > 0 || tiedDeclared.length > 0) ? WINNER_BURST_MS + 600 : 1200,
  );

  return (
    <motion.section
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      initial={false}
      animate={{ boxShadow: flashKey ? "0 0 0 4px rgba(16, 185, 129, 0.35)" : "0 1px 2px rgba(15, 23, 42, 0.06)" }}
      transition={{ duration: 0.8 }}
    >
      {!compact && (winners.length > 0 || tiedDeclared.length > 0) ? (
        <WinnerBurst postId={post.id} postName={post.name} winners={winners} tied={tiedDeclared} seats={post.seats} />
      ) : null}

      <div className="flex shrink-0 items-stretch gap-0 border-b border-slate-200">
        <div
          className={cn(
            "flex items-center px-3 text-[11px] font-black tracking-[0.28em] sm:px-4 sm:text-xs",
            declared ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700",
          )}
        >
          {declared ? "RESULT" : "LIVE COUNT"}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 bg-white px-3 py-2 sm:px-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-sm font-black text-slate-700">
            {serial}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "font-black uppercase leading-tight tracking-tight text-slate-950",
                compact ? "text-sm" : "text-base sm:text-lg md:text-xl",
              )}
            >
              {post.name}
            </h2>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {post.seats} seat{post.seats > 1 ? "s" : ""} · {formatNumber(countedBallots)}
              {votesPolled > 0 ? ` / ${formatNumber(votesPolled)} polled` : " counted"}
              {post.pending_rounds ? ` · ${post.pending_rounds} pending` : ""}
            </p>
          </div>
          {compact ? null : (
            <span
              className={cn(
                "hidden rounded-sm border px-2 py-1 text-[11px] font-black tracking-[0.2em] sm:inline",
                declared ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500",
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>
        {compact ? null : (
          <div className="hidden items-center gap-5 bg-white px-4 sm:flex">
            <StudioStat
              label={invalidSlots ? "Invalid marks" : "Invalid"}
              value={invalidVotes}
              tone="invalid"
            />
            <StudioStat
              label={requireVerification ? "Verified" : "Counted"}
              value={post.total_verified_votes}
            />
          </div>
        )}
      </div>

      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-slate-400"
          style={{ width: `${votesPolled > 0 ? percent(countedBallots, votesPolled) : 0}%` }}
        />
      </div>

      <div
        ref={listRef}
        data-hall-scroll="true"
        className="h-0 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <AnimatePresence>
          {ranked.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm font-black uppercase tracking-[0.22em] text-slate-400">
              No candidates on this post
            </p>
          ) : (
            ranked.map((candidate, index) => {
              const isElected = winners.some((winner) => winner.id === candidate.id);
              const isTied = tiedDeclared.some((item) => item.id === candidate.id);
              const runnerUp = ranked[index + 1];
              const leadMargin =
                index === 0 && runnerUp && candidate.votes > runnerUp.votes
                  ? candidate.votes - runnerUp.votes
                  : 0;
              return (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  rank={competitionRank(ranked, index, (item) => item.votes)}
                  leading={!declared && leadingIds.has(candidate.id)}
                  elected={isElected}
                  tied={isTied}
                  maxVotes={maxVotes}
                  share={percent(candidate.votes, candidateVotes)}
                  margin={leadMargin}
                />
              );
            })
          )}
          {invalidSlots
            ? invalidSlots.some((votes) => votes > 0)
              ? invalidSlots.map((votes, slot) => (
                  <InvalidVotesRow
                    key={`invalid-${slot}`}
                    votes={votes}
                    maxVotes={Math.max(maxVotes, ...invalidSlots)}
                    share={percent(votes, countedMarks)}
                    label={`Invalid ${ordinalMark(slot)}`}
                  />
                ))
              : null
            : invalidVotes > 0 || countedMarks > 0
              ? (
                  <InvalidVotesRow
                    votes={invalidVotes}
                    maxVotes={Math.max(maxVotes, invalidVotes)}
                    share={percent(invalidVotes, countedMarks)}
                  />
                )
              : null}
        </AnimatePresence>
      </div>

      {!compact && portraits.length > 0 ? (
        <div className="grid shrink-0 grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {portraits.map((candidate) => {
            const won = winners.some((winner) => winner.id === candidate.id);
            const isTied = tiedDeclared.some((item) => item.id === candidate.id);
            return (
              <PortraitStrip
                key={candidate.id}
                candidate={candidate}
                badge={won ? "WON" : isTied ? "TIE" : "LEAD"}
              />
            );
          })}
        </div>
      ) : null}
    </motion.section>
  );
}

function useHallListScroll(resetKey: string, delayMs: number) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let cancelled = false;
    let dir: 1 | -1 = 1;
    let last = 0;
    let offset = 0;
    let holdUntil = performance.now() + delayMs;
    const SPEED = 42;

    el.scrollTop = 0;

    function frame(now: number) {
      if (cancelled || !el) return;
      const dt = last ? Math.min(48, now - last) : 16;
      last = now;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (max <= 8) {
        offset = 0;
        el.scrollTop = 0;
        raf = window.requestAnimationFrame(frame);
        return;
      }
      if (now < holdUntil) {
        raf = window.requestAnimationFrame(frame);
        return;
      }
      offset += dir * SPEED * (dt / 1000);
      if (dir === 1 && offset >= max) {
        offset = max;
        dir = -1;
        holdUntil = now + 1400;
      } else if (dir === -1 && offset <= 0) {
        offset = 0;
        dir = 1;
        holdUntil = now + 1400;
      }
      el.scrollTop = offset;
      raf = window.requestAnimationFrame(frame);
    }

    raf = window.requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [resetKey, delayMs]);

  return ref;
}

function StudioStat({ label, value, tone }: { label: string; value: number; tone?: "invalid" }) {
  return (
    <div className="text-right">
      <p className={cn("text-[10px] font-bold uppercase tracking-[0.18em]", tone === "invalid" ? "text-slate-500" : "text-slate-400")}>
        {label}
      </p>
      <LiveCounter
        value={value}
        className="text-3xl font-black tabular-nums leading-none text-slate-950"
      />
    </div>
  );
}

function PortraitStrip({ candidate, badge }: { candidate: LiveCandidate; badge: "WON" | "LEAD" | "TIE" }) {
  const theme = panelTheme(candidate.panel_name, candidate.panel_color);
  const classLabel = candidateClassLabel(candidate.branch, candidate.year, candidate.semester);
  return (
    <div className="flex items-center gap-3 bg-slate-50 px-3 py-2">
      {candidate.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={candidate.photo_url} alt="" className="size-14 rounded-md object-cover ring-1 ring-slate-200" />
      ) : (
        <div
          className="flex size-14 items-center justify-center rounded-md text-lg font-black ring-1 ring-slate-200"
          style={{ background: theme.bg, color: theme.fg }}
        >
          {initials(candidate.name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-black text-slate-950">{candidate.name}</p>
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {panelKey(candidate.panel_name)}
          {classLabel ? ` · ${classLabel}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "rounded-sm border px-2 py-1 text-[11px] font-black tracking-[0.16em]",
          badge === "WON"
            ? "border-slate-900 bg-slate-900 text-white"
            : badge === "TIE"
              ? "border-slate-400 text-slate-600"
              : "border-slate-300 text-slate-500",
        )}
      >
        {badge}
      </span>
      <LiveCounter value={candidate.votes} className="text-3xl font-black tabular-nums text-slate-950" />
    </div>
  );
}

function InvalidVotesRow({
  votes,
  maxVotes,
  share,
  label = "Invalid",
}: {
  votes: number;
  maxVotes: number;
  share: number;
  label?: string;
}) {
  const width = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-2 text-slate-700"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-[10px] font-black text-slate-500">
        INV
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black uppercase tracking-wide">{label}</h3>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-slate-400"
            initial={false}
            animate={{ width: `${width}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 20 }}
          />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <LiveCounter value={votes} className="block text-2xl font-black tabular-nums leading-none text-slate-700 sm:text-3xl" />
        <p className="text-[10px] font-bold tabular-nums text-slate-400">{share}%</p>
      </div>
    </motion.article>
  );
}
