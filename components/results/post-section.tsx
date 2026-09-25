"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { CandidateCard } from "@/components/results/candidate-card";
import { LiveCounter } from "@/components/results/live-counter";
import { WinnerBurst } from "@/components/results/winner-burst";
import type { LivePost } from "@/lib/types";
import {
  formatNumber,
  liveCountedBallots,
  ordinalMark,
  percent,
  postIsDeclared,
  rankByVotesThenName,
  resolveSeats,
  competitionRank,
} from "@/lib/utils";

const SLICE_COLORS = [
  "#059669",
  "#0ea5e9",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
  "#84cc16",
  "#6366f1",
];

export function PostSection({
  post,
  flashKey,
  serial,
  requireVerification,
}: {
  post: LivePost;
  flashKey: number;
  serial: number;
  requireVerification: boolean;
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
  const chartData = [
    ...ranked.map((candidate, index) => ({
      name: candidate.name,
      shortName: candidate.name.split(" ")[0] ?? candidate.name,
      votes: candidate.votes,
      fill: SLICE_COLORS[index % SLICE_COLORS.length],
    })),
    ...(invalidSlots
      ? invalidSlots.map((votes, slot) => ({
          name: `Invalid ${ordinalMark(slot)}`,
          shortName: `Inv ${ordinalMark(slot)}`,
          votes,
          fill: slot === 0 ? "#dc2626" : "#b91c1c",
        }))
      : [{ name: "Invalid", shortName: "Invalid", votes: invalidVotes, fill: "#dc2626" }]),
  ];
  const pieData =
    countedMarks > 0
      ? chartData
      : ranked.map((candidate, index) => ({
          name: candidate.name,
          shortName: candidate.name.split(" ")[0] ?? candidate.name,
          votes: 1,
          fill: SLICE_COLORS[index % SLICE_COLORS.length],
        }));
  const twoCol = ranked.length > 2;
  const barMax = Math.max(maxVotes, ...(invalidSlots ?? [invalidVotes]));

  return (
    <motion.section
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur md:p-4"
      initial={false}
      animate={{ boxShadow: flashKey ? "0 0 0 4px rgba(16,185,129,0.22)" : "0 1px 2px rgba(0,0,0,0.04)" }}
      transition={{ duration: 0.8 }}
    >
      {winners.length > 0 || tiedDeclared.length > 0 ? (
        <WinnerBurst postId={post.id} winners={winners} tied={tiedDeclared} seats={post.seats} />
      ) : null}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-300 text-sm font-black tabular-nums text-emerald-950 md:size-9 md:text-base">
              {serial}
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-emerald-950 md:text-3xl">{post.name}</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              {post.seats} seat{post.seats > 1 ? "s" : ""}
            </span>
            {declared ? (
              <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-black tracking-[0.18em] text-emerald-950">
                DECLARED
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                Counting
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(countedBallots)}
            {votesPolled > 0 ? ` / ${formatNumber(votesPolled)} polled` : " counted"}
            <span className="font-medium text-red-700">
              {" "}
              ·{" "}
              {invalidSlots
                ? invalidSlots.map((votes, slot) => `Invalid ${ordinalMark(slot)} ${formatNumber(votes)}`).join(" · ")
                : `${formatNumber(invalidVotes)} invalid`}
            </span>
            {post.pending_rounds ? ` · ${post.pending_rounds} pending rounds` : ""}
          </p>
        </div>
        <div className="flex items-end gap-5">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-red-600">
              {invalidSlots ? "Invalid marks" : "Invalid"}
            </p>
            <LiveCounter value={invalidVotes} className="text-4xl font-black tabular-nums text-red-700" />
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-600">
              {requireVerification ? "Verified votes" : "Live votes"}
            </p>
            <LiveCounter value={post.total_verified_votes} className="text-4xl font-black tabular-nums text-emerald-950" />
          </div>
        </div>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${votesPolled > 0 ? percent(countedBallots, votesPolled) : 0}%` }}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_min(34%,11rem)] gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(14rem,0.55fr)] lg:grid-rows-1">
        <div
          className={
            twoCol
              ? "grid min-h-0 content-start grid-cols-1 items-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
              : "grid min-h-0 content-start grid-cols-1 items-start gap-2 overflow-y-auto pr-1"
          }
        >
          <AnimatePresence>
            {ranked.map((candidate, index) => {
              const isElected = winners.some((winner) => winner.id === candidate.id);
              const isTied = tiedDeclared.some((item) => item.id === candidate.id);
              return (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                rank={competitionRank(ranked, index, (item) => item.votes)}
                leading={!declared && leadingIds.has(candidate.id)}
                elected={isElected}
                tied={isTied}
                maxVotes={maxVotes}
                seats={post.seats}
                share={percent(candidate.votes, candidateVotes)}
              />
              );
            })}
            {invalidSlots ? (
              invalidSlots.map((votes, slot) => (
                <InvalidVotesCard
                  key={`invalid-${slot}`}
                  votes={votes}
                  maxVotes={barMax}
                  share={percent(votes, countedMarks)}
                  label={`Invalid ${ordinalMark(slot)}`}
                />
              ))
            ) : (
              <InvalidVotesCard votes={invalidVotes} maxVotes={barMax} share={percent(invalidVotes, countedMarks)} />
            )}
          </AnimatePresence>
        </div>
        <div className="flex min-h-0 flex-col rounded-xl border border-emerald-100 bg-slate-50 p-2">
          <p className="px-2 pt-1 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Vote share
          </p>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="votes"
                  nameKey="shortName"
                  cx="50%"
                  cy="50%"
                  innerRadius="42%"
                  outerRadius="72%"
                  paddingAngle={countedMarks > 0 ? 2 : 0}
                  isAnimationActive
                  animationDuration={700}
                >
                  {pieData.map((slice) => (
                    <Cell
                      key={slice.name}
                      fill={countedMarks > 0 ? slice.fill : "#cbd5e1"}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const votes = Number(value);
                    if (countedMarks <= 0) return ["Awaiting votes", item.payload.name];
                    return [`${formatNumber(votes)} (${percent(votes, countedMarks)}%)`, item.payload.name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="mt-2 shrink-0 text-xs text-muted-foreground">
        {formatNumber(countedBallots)} {requireVerification ? "verified" : "counted"}
        <span className="font-medium text-red-700">
          {" "}
          ·{" "}
          {invalidSlots
            ? invalidSlots.map((votes, slot) => `Invalid ${ordinalMark(slot)} ${formatNumber(votes)}`).join(" · ")
            : `${formatNumber(invalidVotes)} invalid`}
        </span>
        {votesPolled > 0
          ? ` · ${percent(countedBallots, votesPolled)}% of ${formatNumber(votesPolled)} polled`
          : ""}
      </p>
    </motion.section>
  );
}

function InvalidVotesCard({
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
      className="relative overflow-hidden rounded-xl border border-red-300 bg-red-50 px-3 py-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-red-200 text-xs font-bold text-red-900">
          INV
        </span>
        <div className="flex size-12 items-center justify-center rounded-full bg-red-200 text-xs font-semibold text-red-800 ring-2 ring-red-300 md:size-14">
          —
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-red-950 md:text-xl">{label}</h3>
          <p className="text-xs text-red-700/80">Spoilt / rejected ballots</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-red-100">
            <motion.div
              className="h-full rounded-full bg-red-500"
              initial={false}
              animate={{ width: `${width}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <LiveCounter value={votes} className="block text-3xl font-black tabular-nums leading-none text-red-700 md:text-4xl" />
          <p className="mt-1 text-[11px] tabular-nums text-red-600">{share}% share</p>
        </div>
      </div>
    </motion.article>
  );
}
