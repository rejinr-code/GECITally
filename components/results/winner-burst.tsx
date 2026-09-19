"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LiveCandidate } from "@/lib/types";
import { candidateClassLabel } from "@/lib/candidate-class";
import { initials } from "@/lib/utils";

const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 8) * 0.08}s`,
  duration: `${2.4 + (index % 5) * 0.25}s`,
  color: ["#fbbf24", "#34d399", "#f43f5e", "#38bdf8", "#f8fafc"][index % 5],
  drift: `${(index % 2 === 0 ? -1 : 1) * (20 + (index % 6) * 12)}px`,
}));

export function WinnerBurst({
  winners,
  seats,
}: {
  winners: LiveCandidate[];
  seats: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 4200);
    return () => window.clearTimeout(timer);
  }, []);

  const headline = seats > 1 ? "ELECTED" : "WINS";
  const lead = winners[0];
  if (!lead) return null;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-[2px]" />
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
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 14 }}
          >
            <p className="text-xs font-semibold tracking-[0.45em] text-amber-300">RESULT DECLARED</p>
            <div className="mt-4 flex items-center gap-4">
              {lead.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.photo_url}
                  alt=""
                  className="size-20 rounded-full object-cover ring-4 ring-amber-300 md:size-24"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full bg-amber-300 text-2xl font-bold text-emerald-950 ring-4 ring-white md:size-24">
                  {initials(lead.name)}
                </div>
              )}
              <div className="text-left">
                <p
                  className="bg-[linear-gradient(90deg,#fde68a,#fff,#f59e0b,#fde68a)] bg-[length:200%_100%] bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-5xl"
                  style={{ animation: "goldShine 1.6s linear infinite" }}
                >
                  {headline}
                </p>
                <p className="mt-1 text-2xl font-semibold text-white md:text-3xl">{lead.name}</p>
                <p className="text-sm text-emerald-100">
                  {[candidateClassLabel(lead.branch, lead.year, lead.semester), lead.panel_name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            {winners.length > 1 ? (
              <p className="mt-4 text-sm text-amber-100">
                with {winners.slice(1).map((winner) => winner.name).join(", ")}
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
