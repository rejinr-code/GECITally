"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { LiveCandidate } from "@/lib/types";
import { useHallListScroll } from "@/hooks/use-hall-list-scroll";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme } from "@/lib/results-studio";
import { cn, initials } from "@/lib/utils";

export const WINNER_BURST_MS = 4800;

export function winnerBurstMs(people: number) {
  if (people <= 2) return WINNER_BURST_MS;
  return WINNER_BURST_MS + Math.min(7000, (people - 2) * 800);
}

const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 8) * 0.08}s`,
  duration: `${2.4 + (index % 5) * 0.25}s`,
  color: ["#fbbf24", "#34d399", "#f43f5e", "#38bdf8", "#f8fafc"][index % 5],
  drift: `${(index % 2 === 0 ? -1 : 1) * (20 + (index % 6) * 12)}px`,
}));

export function WinnerBurst({
  postId,
  postName,
  winners,
  tied = [],
  seats,
}: {
  postId: string;
  postName: string;
  winners: LiveCandidate[];
  tied?: LiveCandidate[];
  seats: number;
}) {
  const [visible, setVisible] = useState(true);
  const people = winners.length + tied.length;
  const holdMs = winnerBurstMs(people);
  const crowded = people >= 3 || (winners.length > 0 && tied.length > 0);
  const listRef = useHallListScroll(`${postId}:burst`, 700, crowded && visible);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), holdMs);
    return () => window.clearTimeout(timer);
  }, [postId, holdMs]);

  if ((!winners.length && !tied.length) || !visible) return null;

  const headline = tied.length && !winners.length ? "TIE" : seats > 1 ? "ELECTED" : "WINS";
  const remainingSeats = Math.max(0, seats - winners.length);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute inset-0 bg-white" />
      {CONFETTI.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 h-3 w-1.5 rounded-sm"
          style={
            {
              left: piece.left,
              background: piece.color,
              animation: `confettiFall ${piece.duration} linear ${piece.delay} both`,
              "--drift": piece.drift,
            } as CSSProperties
          }
        />
      ))}
      <div className="absolute inset-0 flex min-h-0 flex-col px-4 py-3 md:px-8">
        <div className="shrink-0 text-center">
          <p className="inline-block rounded-sm bg-red-600 px-3 py-1 text-[10px] font-black tracking-[0.4em] text-white sm:text-xs">
            RESULT DECLARED
          </p>
          <p className="mt-1.5 text-[10px] font-black tracking-[0.32em] text-red-600">POST</p>
          <p className="mx-auto max-w-4xl px-2 text-base font-black uppercase leading-tight tracking-tight text-slate-950 sm:text-xl">
            {postName}
          </p>
          <p
            className={cn(
              "mt-1 bg-[linear-gradient(90deg,#fde68a,#f59e0b,#facc15,#fde68a)] bg-[length:200%_100%] bg-clip-text font-black tracking-tight text-transparent",
              crowded ? "text-3xl md:text-4xl" : "text-4xl md:text-6xl",
            )}
            style={{ animation: "goldShine 1.6s linear infinite" }}
          >
            {headline}
          </p>
        </div>

        {crowded ? (
          <div
            ref={listRef}
            data-hall-scroll="winners"
            className="mx-auto mt-2 h-0 min-h-0 w-full max-w-2xl flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {winners.length > 0 ? (
              <section className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-1.5">
                <p className="text-[10px] font-black tracking-[0.24em] text-amber-800">
                  ELECTED · {winners.length} {winners.length === 1 ? "SEAT" : "SEATS"}
                </p>
                <div className="mt-0.5 divide-y divide-amber-100">
                  {winners.map((winner, index) => (
                    <WinnerRow key={winner.id} winner={winner} index={index} badge="WON" />
                  ))}
                </div>
              </section>
            ) : null}
            {tied.length > 0 ? (
              <section className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5">
                <p className="text-[10px] font-black tracking-[0.24em] text-sky-800">
                  TIED FOR {remainingSeats || seats} REMAINING SEAT
                  {(remainingSeats || seats) === 1 ? "" : "S"}
                </p>
                <div className="mt-0.5 divide-y divide-sky-100">
                  {tied.map((candidate, index) => (
                    <WinnerRow
                      key={candidate.id}
                      winner={candidate}
                      index={winners.length + index}
                      badge="TIE"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : winners.length === 1 && tied.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-5">
              <WinnerFace winner={winners[0]} />
              <div className="text-left">
                <p className="text-3xl font-black text-slate-950 md:text-4xl">{winners[0].name}</p>
                <WinnerDetail winner={winners[0]} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
            {winners.length > 0 ? (
              <div className="flex flex-wrap items-start justify-center gap-6">
                {winners.map((winner, index) => (
                  <WinnerPortrait key={winner.id} winner={winner} index={index} compact={people > 1} />
                ))}
              </div>
            ) : null}
            {tied.length > 0 ? (
              <div className="mt-4 w-full max-w-3xl rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <p className="text-center text-xs font-black tracking-[0.28em] text-sky-700">
                  TIED FOR {remainingSeats || seats} REMAINING SEAT
                  {(remainingSeats || seats) === 1 ? "" : "S"}
                </p>
                <div className="mt-3 flex flex-wrap items-start justify-center gap-6">
                  {tied.map((candidate, index) => (
                    <WinnerPortrait
                      key={candidate.id}
                      winner={candidate}
                      index={winners.length + index}
                      compact
                      tied
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function winnerDetail(winner: LiveCandidate) {
  return [candidateClassLabel(winner.branch, winner.year, winner.semester), panelKey(winner.panel_name)]
    .filter(Boolean)
    .join(" · ");
}

function WinnerFace({ winner, compact = false, tied = false }: { winner: LiveCandidate; compact?: boolean; tied?: boolean }) {
  const theme = panelTheme(winner.panel_name, winner.panel_color);
  if (winner.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={winner.photo_url}
        alt=""
        className={cn(
          "rounded-full object-cover ring-4",
          tied ? "ring-sky-400" : "ring-amber-400",
          compact ? "size-16 md:size-20" : "size-24 md:size-28",
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-black ring-4",
        tied ? "ring-sky-400" : "ring-amber-400",
        compact ? "size-16 text-xl md:size-20" : "size-24 text-3xl md:size-28",
      )}
      style={{ background: theme.bg, color: theme.fg }}
    >
      {initials(winner.name ?? "")}
    </div>
  );
}

function WinnerDetail({ winner }: { winner: LiveCandidate }) {
  const detail = winnerDetail(winner);
  if (!detail) return null;
  return <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{detail}</p>;
}

function WinnerPortrait({
  winner,
  index,
  compact = false,
  tied = false,
}: {
  winner: LiveCandidate;
  index: number;
  compact?: boolean;
  tied?: boolean;
}) {
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + index * 0.08, type: "spring", stiffness: 180, damping: 16 }}
    >
      <WinnerFace winner={winner} compact={compact} tied={tied} />
      <p className={cn("mt-3 font-black text-slate-950", compact ? "text-lg md:text-xl" : "text-2xl md:text-3xl")}>
        {winner.name}
      </p>
      <WinnerDetail winner={winner} />
    </motion.div>
  );
}

function WinnerRow({
  winner,
  index,
  badge,
}: {
  winner: LiveCandidate;
  index: number;
  badge: "WON" | "TIE";
}) {
  const theme = panelTheme(winner.panel_name, winner.panel_color);
  const detail = winnerDetail(winner);
  return (
    <motion.div
      className="flex items-center gap-2.5 py-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 + index * 0.04 }}
    >
      {winner.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={winner.photo_url} alt="" className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white" />
      ) : (
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black ring-2 ring-white"
          style={{ background: theme.bg, color: theme.fg }}
        >
          {initials(winner.name ?? "")}
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-base font-black leading-tight tracking-tight text-slate-950">{winner.name}</p>
        {detail ? (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{detail}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-right text-sm font-black tabular-nums text-slate-800">
        {winner.votes}
      </span>
      <span
        className={cn(
          "w-12 shrink-0 rounded-sm px-1.5 py-0.5 text-center text-[10px] font-black tracking-[0.16em]",
          badge === "WON" ? "bg-amber-300 text-slate-950" : "bg-sky-200 text-sky-950",
        )}
      >
        {badge}
      </span>
    </motion.div>
  );
}
