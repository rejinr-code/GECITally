"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { CandidateCard } from "@/components/results/candidate-card";
import { LiveCounter } from "@/components/results/live-counter";
import { WinnerBurst } from "@/components/results/winner-burst";
import type { ElectionState, LivePost } from "@/lib/types";
import { formatNumber, percent } from "@/lib/utils";

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
  electionState,
  serial,
  requireVerification,
}: {
  post: LivePost;
  flashKey: number;
  electionState: ElectionState;
  serial: number;
  requireVerification: boolean;
}) {
  const ranked = [...post.candidates].sort((a, b) => b.votes - a.votes);
  const maxVotes = ranked[0]?.votes ?? 0;
  const voteTotal = ranked.reduce((sum, candidate) => sum + candidate.votes, 0);
  const votesPolled = post.votes_polled ?? 0;
  const declared = post.is_finalised || electionState === "finalised";
  const winners = declared ? ranked.slice(0, post.seats).filter((candidate) => candidate.votes > 0) : [];
  const chartData = ranked.map((candidate, index) => ({
    name: candidate.name,
    shortName: candidate.name.split(" ")[0] ?? candidate.name,
    votes: candidate.votes,
    fill: SLICE_COLORS[index % SLICE_COLORS.length],
  }));
  const pieData = voteTotal > 0 ? chartData : chartData.map((row) => ({ ...row, votes: 1 }));
  const twoCol = ranked.length > 2;

  return (
    <motion.section
      layout
      key={`${post.id}-${flashKey}`}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur md:p-4"
      initial={false}
      animate={{ boxShadow: flashKey ? "0 0 0 4px rgba(16,185,129,0.22)" : "0 1px 2px rgba(0,0,0,0.04)" }}
      transition={{ duration: 0.8 }}
    >
      {winners.length > 0 ? <WinnerBurst key={post.id} winners={winners} seats={post.seats} /> : null}

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
            {formatNumber(post.total_verified_votes)}
            {votesPolled > 0 ? ` / ${formatNumber(votesPolled)} polled` : " counted"}
            {post.pending_rounds ? ` · ${post.pending_rounds} pending rounds` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-600">
            {requireVerification ? "Verified votes" : "Live votes"}
          </p>
          <LiveCounter value={post.total_verified_votes} className="text-4xl font-black tabular-nums text-emerald-950" />
        </div>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${votesPolled > 0 ? percent(post.total_verified_votes, votesPolled) : 0}%` }}
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
            {ranked.map((candidate, index) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                rank={index + 1}
                leading={index < post.seats && candidate.votes > 0}
                elected={winners.some((winner) => winner.id === candidate.id)}
                maxVotes={maxVotes}
                seats={post.seats}
                share={percent(candidate.votes, voteTotal)}
              />
            ))}
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
                  paddingAngle={voteTotal > 0 ? 2 : 0}
                  isAnimationActive
                  animationDuration={700}
                >
                  {pieData.map((slice) => (
                    <Cell
                      key={slice.name}
                      fill={voteTotal > 0 ? slice.fill : "#cbd5e1"}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const votes = Number(value);
                    if (voteTotal <= 0) return ["Awaiting votes", item.payload.name];
                    return [`${formatNumber(votes)} (${percent(votes, voteTotal)}%)`, item.payload.name];
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
        {formatNumber(post.total_verified_votes)} {requireVerification ? "verified" : "counted"}
        {votesPolled > 0
          ? ` · ${percent(post.total_verified_votes, votesPolled)}% of ${formatNumber(votesPolled)} polled`
          : ""}
      </p>
    </motion.section>
  );
}
