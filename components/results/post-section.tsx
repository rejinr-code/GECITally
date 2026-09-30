"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CandidateCard } from "@/components/results/candidate-card";
import { LiveCounter } from "@/components/results/live-counter";
import { WinnerBurst, winnerBurstMs } from "@/components/results/winner-burst";
import { useHallListScroll } from "@/hooks/use-hall-list-scroll";
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
    declared && (winners.length > 0 || tiedDeclared.length > 0)
      ? winnerBurstMs(winners.length + tiedDeclared.length) + 600
      : 1200,
  );

  return (
    <motion.section
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm",
        declared ? "border-amber-200 bg-[#fff8e1]" : "border-emerald-200 bg-emerald-50/80",
      )}
      initial={false}
      animate={{ boxShadow: flashKey ? "0 0 0 4px rgba(16, 185, 129, 0.35)" : "0 1px 2px rgba(15, 23, 42, 0.06)" }}
      transition={{ duration: 0.8 }}
    >
      {!compact && (winners.length > 0 || tiedDeclared.length > 0) ? (
        <WinnerBurst postId={post.id} postName={post.name} winners={winners} tied={tiedDeclared} seats={post.seats} />
      ) : null}

      <div className={cn("flex shrink-0 items-stretch gap-0 border-b", declared ? "border-amber-200" : "border-emerald-200")}>
        <div
          className={cn(
            "flex items-center px-3 text-[11px] font-black tracking-[0.28em] sm:px-4 sm:text-xs",
            declared ? "bg-[#c9a227] text-slate-950" : "bg-emerald-900 text-white",
          )}
        >
          {declared ? "FINAL" : "LIVE"}
        </div>
        <div className={cn("flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:px-4", declared ? "bg-[#fff8e1]" : "bg-emerald-50/80")}>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-sm text-sm font-black",
              declared ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950",
            )}
          >
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
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.16em]",
                declared ? "text-amber-900/70" : "text-emerald-800/80",
              )}
            >
              {declared ? "Declared result" : "Counting in progress"}
              {" · "}
              {post.seats} seat{post.seats > 1 ? "s" : ""} · {formatNumber(countedBallots)}
              {votesPolled > 0 ? ` / ${formatNumber(votesPolled)} polled` : " counted"}
              {post.pending_rounds ? ` · ${post.pending_rounds} pending` : ""}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-sm px-2 py-1 text-[11px] font-black tracking-[0.2em]",
              declared
                ? "bg-[#c9a227] text-slate-950"
                : statusLabel === "LEADING"
                  ? "bg-emerald-800 text-white"
                  : "bg-emerald-900 text-white",
            )}
          >
            {statusLabel}
          </span>
        </div>
        {compact ? null : (
          <div className={cn("hidden items-center gap-5 px-4 sm:flex", declared ? "bg-[#fff8e1]" : "bg-emerald-50/80")}>
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

      <div className={cn("h-1", declared ? "bg-amber-100" : "bg-emerald-100")}>
        <div
          className={cn("h-full", declared ? "bg-[#c9a227]" : "bg-emerald-700")}
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
                  share={percent(candidate.votes, countedMarks)}
                  margin={leadMargin}
                  dense={ranked.length >= 4}
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
                    share={percent(votes, countedMarks)}
                    label={`Invalid ${ordinalMark(slot)}`}
                  />
                ))
              : null
            : invalidVotes > 0 || countedMarks > 0
              ? (
                  <InvalidVotesRow
                    votes={invalidVotes}
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
          "rounded-sm px-2 py-1 text-[11px] font-black tracking-[0.16em]",
          badge === "WON"
            ? "bg-[#c9a227] text-slate-950"
            : badge === "TIE"
              ? "border border-amber-700 bg-amber-100 text-amber-900"
              : "bg-emerald-800 text-white",
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
  share,
  label = "Invalid",
}: {
  votes: number;
  share: number;
  label?: string;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-slate-100 bg-white px-3 py-2 text-slate-700"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-[10px] font-black text-slate-500">
          INV
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-black uppercase tracking-wide">{label}</h3>
        <div className="w-[4.5rem] shrink-0 text-right sm:w-24">
          <LiveCounter value={votes} className="block text-2xl font-black tabular-nums leading-none text-slate-700 sm:text-3xl" />
          <p className="text-[10px] font-bold tabular-nums text-slate-400">{share}%</p>
        </div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
        <motion.div
          className="h-full rounded-full bg-slate-400"
          initial={false}
          animate={{ width: `${share}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
    </motion.article>
  );
}
