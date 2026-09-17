"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { CandidateCard } from "@/components/results/candidate-card";
import { LiveCounter } from "@/components/results/live-counter";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { LivePost } from "@/lib/types";
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
  countLimit,
  flashKey,
}: {
  post: LivePost;
  countLimit: number;
  flashKey: number;
}) {
  const ranked = [...post.candidates].sort((a, b) => b.votes - a.votes);
  const maxVotes = ranked[0]?.votes ?? 0;
  const voteTotal = ranked.reduce((sum, candidate) => sum + candidate.votes, 0);
  const votesPolled = post.votes_polled ?? 0;
  const chartData = ranked.map((candidate, index) => ({
    name: candidate.name,
    shortName: candidate.name.split(" ")[0] ?? candidate.name,
    votes: candidate.votes,
    fill: SLICE_COLORS[index % SLICE_COLORS.length],
  }));
  const pieData = voteTotal > 0 ? chartData : chartData.map((row) => ({ ...row, votes: 1 }));
  const twoCol = ranked.length > 1;

  return (
    <motion.section
      layout
      key={`${post.id}-${flashKey}`}
      className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur md:p-5"
      initial={false}
      animate={{ boxShadow: flashKey ? "0 0 0 4px rgba(16,185,129,0.18)" : "0 1px 2px rgba(0,0,0,0.04)" }}
      transition={{ duration: 0.8 }}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{post.name}</h2>
            <Badge variant="secondary">
              {post.seats} seat{post.seats > 1 ? "s" : ""}
            </Badge>
            {post.is_finalised && <Badge>Finalised</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified rounds {post.verified_rounds}/{countLimit}
            {post.pending_rounds ? ` · ${post.pending_rounds} pending` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Verified votes</p>
          <LiveCounter value={post.total_verified_votes} className="text-3xl font-semibold tabular-nums" />
        </div>
      </div>

      <Progress value={percent(post.verified_rounds, countLimit)} className="mb-4" />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_min(40%,13rem)] gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.7fr)] md:grid-rows-1">
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
                maxVotes={maxVotes}
                seats={post.seats}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="flex min-h-0 flex-col rounded-xl bg-slate-50 p-2">
          <p className="px-2 pt-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
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

      <p className="mt-3 shrink-0 text-sm text-muted-foreground">
        {formatNumber(post.total_verified_votes)} verified votes
        {votesPolled > 0
          ? ` · ${percent(post.total_verified_votes, votesPolled)}% of ${formatNumber(votesPolled)} polled`
          : ""}
      </p>
    </motion.section>
  );
}
