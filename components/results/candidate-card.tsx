"use client";

import { motion } from "framer-motion";
import { LiveCounter } from "@/components/results/live-counter";
import { initials } from "@/lib/utils";
import { candidateClassLabel } from "@/lib/candidate-class";
import type { LiveCandidate } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CandidateCard({
  candidate,
  rank,
  leading,
  elected,
  maxVotes,
  seats,
  share,
}: {
  candidate: LiveCandidate;
  rank: number;
  leading: boolean;
  elected: boolean;
  maxVotes: number;
  seats: number;
  share: number;
}) {
  const classLabel = candidateClassLabel(candidate.branch, candidate.year, candidate.semester);
  const width = maxVotes > 0 ? (candidate.votes / maxVotes) * 100 : 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border px-3 py-3",
        elected
          ? "border-amber-300/80 bg-gradient-to-r from-amber-400/20 via-emerald-900/70 to-emerald-950/80 shadow-[0_0_24px_rgba(251,191,36,0.28)]"
          : leading
            ? "border-emerald-300/50 bg-emerald-900/50"
            : "border-white/10 bg-black/25",
      )}
    >
      {elected ? (
        <motion.span
          initial={{ x: 40, opacity: 0, rotate: 12 }}
          animate={{ x: 0, opacity: 1, rotate: -8 }}
          className="absolute right-3 top-2 rounded bg-amber-300 px-2 py-0.5 text-[10px] font-black tracking-[0.2em] text-emerald-950"
        >
          ELECTED
        </motion.span>
      ) : null}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums",
            elected ? "bg-amber-300 text-emerald-950" : "bg-white/10 text-white",
          )}
        >
          {rank}
        </span>
        {candidate.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photo_url}
            alt=""
            className={cn(
              "size-12 rounded-full object-cover ring-2 md:size-14",
              elected ? "ring-amber-300" : "ring-white/20",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full text-sm font-semibold ring-2 md:size-14",
              elected
                ? "bg-amber-200 text-emerald-950 ring-amber-300"
                : "bg-emerald-800 text-white ring-white/20",
            )}
          >
            {initials(candidate.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="truncate text-lg font-semibold text-white md:text-xl">{candidate.name}</h3>
            {classLabel ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                {classLabel}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-emerald-100/70">
            {candidate.panel_name ?? "Independent"}
            {leading && !elected ? ` · Leading · Top ${seats}` : ""}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40">
            <motion.div
              className={cn(
                "h-full rounded-full",
                elected ? "bg-amber-300" : leading ? "bg-emerald-400" : "bg-slate-400",
              )}
              initial={false}
              animate={{ width: `${width}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <LiveCounter
            value={candidate.votes}
            className={cn(
              "block text-3xl font-black tabular-nums leading-none md:text-4xl",
              elected ? "text-amber-300" : "text-white",
            )}
          />
          <p className="mt-1 text-[11px] tabular-nums text-emerald-200">{share}% share</p>
        </div>
      </div>
    </motion.article>
  );
}
