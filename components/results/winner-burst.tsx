"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { LiveCandidate } from "@/lib/types";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme } from "@/lib/results-studio";
import { cn, initials } from "@/lib/utils";

export const WINNER_BURST_MS = 4800;

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

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), WINNER_BURST_MS);
    return () => window.clearTimeout(timer);
  }, [postId]);

  if ((!winners.length && !tied.length) || !visible) return null;

  const multi = winners.length + tied.length > 1;
  const headline = tied.length && !winners.length ? "TIE" : seats > 1 ? "ELECTED" : "WINS";
  const remainingSeats = Math.max(0, seats - winners.length);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
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
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center md:px-8"
        initial={{ scale: 0.7, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 14 }}
      >
        <p className="rounded-sm bg-red-600 px-4 py-1.5 text-xs font-black tracking-[0.4em] text-white sm:text-sm">
          RESULT DECLARED
        </p>
        <p className="mt-2 text-[11px] font-black tracking-[0.32em] text-red-600">POST</p>
        <p className="max-w-4xl px-2 text-lg font-black uppercase leading-tight tracking-tight text-slate-950 sm:text-2xl">
          {postName}
        </p>
        {multi || tied.length > 0 ? (
          <>
            <p
              className="mt-2 bg-[linear-gradient(90deg,#fde68a,#f59e0b,#facc15,#fde68a)] bg-[length:200%_100%] bg-clip-text text-5xl font-black tracking-tight text-transparent md:text-6xl"
              style={{ animation: "goldShine 1.6s linear infinite" }}
            >
              {headline}
            </p>
            {winners.length > 0 ? (
              <div
                className={cn(
                  "mt-3 grid w-full max-w-3xl items-start justify-items-center gap-4",
                  winners.length === 1 ? "grid-cols-1" : winners.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
                )}
              >
                {winners.map((winner, index) => (
                  <WinnerPortrait key={winner.id} winner={winner} index={index} compact={winners.length + tied.length > 1} />
                ))}
              </div>
            ) : null}
            {tied.length > 0 ? (
              <>
                <p className="mt-3 text-xs font-black tracking-[0.28em] text-sky-700">
                  TIE FOR {remainingSeats || seats} SEAT{remainingSeats === 1 ? "" : "S"}
                </p>
                <div
                  className={cn(
                    "mt-2 grid w-full max-w-3xl items-start justify-items-center gap-4",
                    tied.length === 1 ? "grid-cols-1" : "grid-cols-2",
                  )}
                >
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
              </>
            ) : null}
          </>
        ) : (
          <div className="mt-4 flex items-center gap-5">
            <WinnerFace winner={winners[0]} />
            <div className="text-left">
              <p
                className="bg-[linear-gradient(90deg,#fde68a,#f59e0b,#facc15,#fde68a)] bg-[length:200%_100%] bg-clip-text text-6xl font-black tracking-tight text-transparent md:text-7xl"
                style={{ animation: "goldShine 1.6s linear infinite" }}
              >
                {headline}
              </p>
              <p className="mt-1 text-3xl font-black text-slate-950 md:text-4xl">{winners[0].name}</p>
              <WinnerDetail winner={winners[0]} />
            </div>
          </div>
        )}
      </motion.div>
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
