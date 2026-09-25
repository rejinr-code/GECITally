"use client";

import { motion } from "framer-motion";
import { LiveCounter } from "@/components/results/live-counter";
import { initials } from "@/lib/utils";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme } from "@/lib/results-studio";
import type { LiveCandidate } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAR = "#334155";

export function CandidateCard({
  candidate,
  rank,
  leading,
  elected,
  tied = false,
  maxVotes,
  share,
  margin,
}: {
  candidate: LiveCandidate;
  rank: number;
  leading: boolean;
  elected: boolean;
  tied?: boolean;
  maxVotes: number;
  share: number;
  margin?: number;
}) {
  const classLabel = candidateClassLabel(candidate.branch, candidate.year, candidate.semester);
  const width = maxVotes > 0 ? (candidate.votes / maxVotes) * 100 : 0;
  const panel = panelKey(candidate.panel_name);
  const theme = panelTheme(panel);
  const status = elected ? "WON" : tied ? "TIE" : leading ? "LEAD" : "";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden border-b border-slate-100 px-2 py-1.5 text-slate-950 last:border-b-0 sm:px-3 sm:py-2",
        elected ? "border-l-4 border-l-slate-900 bg-slate-50" : tied ? "border-l-4 border-l-slate-300 bg-white" : "bg-white",
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-xs font-black tabular-nums text-slate-700 sm:size-8 sm:text-sm">
          {maxVotes > 0 ? rank : "–"}
        </span>
        {candidate.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photo_url}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200 sm:size-12"
          />
        ) : (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-black ring-1 ring-slate-200 sm:size-12 sm:text-sm"
            style={{ background: theme.bg, color: theme.fg }}
          >
            {initials(candidate.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="truncate text-base font-black tracking-tight sm:text-xl">{candidate.name}</h3>
            {classLabel ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{classLabel}</span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
              style={{ background: theme.bg, color: theme.fg }}
            >
              {panel}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="h-full rounded-full"
                style={{ background: BAR }}
                initial={false}
                animate={{ width: `${width}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 20 }}
              />
            </div>
          </div>
        </div>
        {status ? (
          <span
            className={cn(
              "hidden shrink-0 rounded-sm border px-2 py-1 text-[11px] font-black tracking-[0.14em] sm:inline",
              elected
                ? "border-slate-900 bg-slate-900 text-white"
                : tied
                  ? "border-slate-400 text-slate-600"
                  : "border-slate-300 text-slate-500",
            )}
          >
            {status}
          </span>
        ) : null}
        <div className="w-[4.5rem] shrink-0 text-right sm:w-24">
          <LiveCounter
            value={candidate.votes}
            className="block text-2xl font-black tabular-nums leading-none sm:text-4xl"
          />
          {leading && !elected && !tied && margin && margin > 0 ? (
            <p className="mt-0.5 text-[10px] font-black tabular-nums tracking-wide text-slate-500">LEAD {margin}</p>
          ) : (
            <p className="mt-0.5 text-[10px] font-bold tabular-nums text-slate-500">{share}%</p>
          )}
        </div>
      </div>
    </motion.article>
  );
}
