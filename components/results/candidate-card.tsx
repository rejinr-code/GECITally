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
  dense = false,
}: {
  candidate: LiveCandidate;
  rank: number;
  leading: boolean;
  elected: boolean;
  tied?: boolean;
  maxVotes: number;
  share: number;
  margin?: number;
  dense?: boolean;
}) {
  const classLabel = candidateClassLabel(candidate.branch, candidate.year, candidate.semester);
  const panel = panelKey(candidate.panel_name);
  const theme = panelTheme(panel, candidate.panel_color);
  const status = elected ? "WON" : tied ? "TIE" : leading ? "LEAD" : "";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden border-b px-3 text-slate-950 last:border-b-0",
        dense ? "py-1" : "py-2",
        elected
          ? "border-b-amber-100 bg-amber-50/80 shadow-[inset_4px_0_0_0_#c9a227]"
          : tied
            ? "border-b-amber-100 bg-white shadow-[inset_4px_0_0_0_#fbbf24]"
            : leading
              ? "border-b-emerald-100 bg-emerald-50/60 shadow-[inset_4px_0_0_0_#047857]"
              : "border-b-slate-100 bg-white",
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-sm bg-slate-100 font-black tabular-nums text-slate-700",
            dense ? "size-6 text-[11px]" : "size-7 text-xs sm:size-8 sm:text-sm",
          )}
        >
          {maxVotes > 0 ? rank : "–"}
        </span>
        {candidate.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photo_url}
            alt=""
            className={cn(
              "shrink-0 rounded-full object-cover ring-1 ring-slate-200",
              dense ? "size-8" : "size-10 sm:size-12",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full font-black ring-1 ring-slate-200",
              dense ? "size-8 text-[11px]" : "size-10 text-xs sm:size-12 sm:text-sm",
            )}
            style={{ background: theme.bg, color: theme.fg }}
          >
            {initials(candidate.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className={cn("truncate font-black tracking-tight", dense ? "text-sm" : "text-base sm:text-xl")}>
              {candidate.name}
            </h3>
            {classLabel && !dense ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{classLabel}</span>
            ) : null}
          </div>
          <span
            className="mt-0.5 inline-flex rounded-sm px-1.5 py-px text-[9px] font-black uppercase tracking-wide"
            style={{ background: theme.bg, color: theme.fg }}
          >
            {panel}
          </span>
        </div>
        {status ? (
          <span
            className={cn(
              "hidden shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-black tracking-[0.14em] sm:inline",
              elected
                ? "bg-[#c9a227] text-slate-950"
                : tied
                  ? "border border-amber-700 bg-amber-100 text-amber-900"
                  : "bg-emerald-800 text-white",
            )}
          >
            {status}
          </span>
        ) : null}
        <div className={cn("shrink-0 text-right", dense ? "w-14" : "w-[4.5rem] sm:w-24")}>
          <LiveCounter
            value={candidate.votes}
            className={cn(
              "block font-black tabular-nums leading-none",
              dense ? "text-xl" : "text-2xl sm:text-4xl",
            )}
          />
          {leading && !elected && !tied && margin && margin > 0 ? (
            <p className="mt-0.5 text-[10px] font-black tabular-nums tracking-wide text-slate-500">LEAD {margin}</p>
          ) : (
            <p className="mt-0.5 text-[10px] font-bold tabular-nums text-slate-500">{share}%</p>
          )}
        </div>
      </div>
      <div className={cn("w-full overflow-hidden rounded-full bg-slate-200/80", dense ? "mt-1 h-1" : "mt-2 h-2")}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: elected ? "#c9a227" : leading ? "#047857" : BAR }}
          initial={false}
          animate={{ width: `${share}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
    </motion.article>
  );
}
