"use client";

import { motion } from "framer-motion";
import { LiveCounter } from "@/components/results/live-counter";
import { formatDate } from "@/lib/utils";
import type { PublicHallStage } from "@/lib/utils";

export function HallStageView({
  stage,
  electionName,
  electionDate,
  votesPolled,
  postCount,
}: {
  stage: Exclude<PublicHallStage, "live">;
  electionName: string;
  electionDate?: string;
  votesPolled: number;
  postCount?: number;
}) {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm">
      <div
        className={cnBar(stage)}
      >
        <span className="size-2 rounded-full bg-white" style={{ animation: "livePulse 1.4s ease-out infinite" }} />
        <p className="text-[11px] font-black tracking-[0.28em]">{barLabel(stage)}</p>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-8 text-center">
        {stage === "standby" ? (
          <TitleCard electionName={electionName} electionDate={electionDate} />
        ) : stage === "poll" ? (
          <PollCompletedCard
            electionName={electionName}
            electionDate={electionDate}
            votesPolled={votesPolled}
            postCount={postCount}
          />
        ) : stage === "counting" ? (
          <MessageCard kicker="COUNTING" title="Counting started" detail="Results will appear here after the first round." />
        ) : (
          <MessageCard kicker="RESULT" title="Counting completed" detail="Declared results follow." />
        )}
      </div>
    </section>
  );
}

function cnBar(stage: Exclude<PublicHallStage, "live">) {
  const tone =
    stage === "poll"
      ? "bg-emerald-800"
      : stage === "counting"
        ? "bg-red-600"
        : stage === "final"
          ? "bg-[#c9a227] text-slate-950"
          : "bg-slate-900";
  return `flex shrink-0 items-center gap-2 px-4 py-2 text-white ${tone}`;
}

function barLabel(stage: Exclude<PublicHallStage, "live">) {
  if (stage === "poll") return "POLL COMPLETED";
  if (stage === "counting") return "COUNTING STARTED";
  if (stage === "final") return "COUNTING COMPLETED";
  return "GECI TALLY";
}

function TitleCard({ electionName, electionDate }: { electionName: string; electionDate?: string }) {
  return (
    <motion.div
      className="max-w-5xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
    >
      <p className="text-[11px] font-black tracking-[0.42em] text-emerald-400">GECI TALLY</p>
      <h2 className="mt-5 text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-6xl">
        {electionName}
      </h2>
      {electionDate ? (
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-slate-400">{formatDate(electionDate)}</p>
      ) : null}
    </motion.div>
  );
}

function PollCompletedCard({
  electionName,
  electionDate,
  votesPolled,
  postCount,
}: {
  electionName: string;
  electionDate?: string;
  votesPolled: number;
  postCount?: number;
}) {
  return (
    <motion.div
      className="max-w-5xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
    >
      <p className="text-[11px] font-black tracking-[0.42em] text-emerald-400">POLL COMPLETED</p>
      <LiveCounter
        value={votesPolled}
        className="mt-5 block text-7xl font-black tabular-nums leading-none text-white sm:text-8xl"
      />
      <p className="mt-4 text-lg font-black uppercase tracking-[0.28em] text-white">
        {votesPolled === 1 ? "Vote polled" : "Votes polled"}
      </p>
      <p className="mt-6 text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
        {electionName}
        {electionDate ? ` · ${formatDate(electionDate)}` : ""}
        {postCount ? ` · ${postCount} ${postCount === 1 ? "post" : "posts"}` : ""}
      </p>
      <p className="mt-8 text-2xl font-black uppercase tracking-tight text-amber-300 sm:text-3xl">
        Counting to be started soon
      </p>
    </motion.div>
  );
}

function MessageCard({ kicker, title, detail }: { kicker: string; title: string; detail: string }) {
  return (
    <motion.div
      className="max-w-5xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
    >
      <p className="text-[11px] font-black tracking-[0.42em] text-red-400">{kicker}</p>
      <h2 className="mt-5 text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-6xl">{title}</h2>
      <p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-slate-400">{detail}</p>
    </motion.div>
  );
}
