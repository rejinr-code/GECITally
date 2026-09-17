import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Name({
  children,
  light,
  gold = false,
}: {
  children: ReactNode;
  light?: boolean;
  gold?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-semibold",
        gold
          ? light
            ? "text-amber-300"
            : "text-gold"
          : light
            ? "text-white"
            : "text-emerald-950",
      )}
    >
      {children}
    </span>
  );
}

function CreditCopy({ light }: { light?: boolean }) {
  const muted = light ? "text-emerald-100/80" : "text-emerald-700/75";

  return (
    <>
      <Name light={light}>Prof. Rejin R</Name>
      <span className={muted}>, Asst. Professor in IT, </span>
      <Name light={light} gold>
        Campus Lead Enabler
      </Name>
      <span className={muted}>, </span>
      <Name light={light}>µLearn GECI</Name>
    </>
  );
}

export function MulearnCredit({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center rounded-2xl border",
        compact ? "gap-2.5 px-2.5 py-1.5" : "gap-3.5 px-3.5 py-2.5",
        light
          ? "shrink-0 border-amber-300/25 bg-gradient-to-r from-white/12 to-transparent"
          : "border-emerald-200/90 bg-white shadow-[0_10px_28px_-18px_rgba(4,120,87,0.55)]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mulearn-logo.png"
        alt="µLearn IDK"
        className={cn(
          "shrink-0 rounded-lg bg-black object-contain ring-1",
          compact ? "h-8 w-auto" : "h-12 w-auto",
          light ? "ring-amber-300/40" : "ring-gold/40",
        )}
      />
      {compact ? (
        <p className="min-w-0 text-[11px] leading-snug sm:text-xs">
          <Name light={light}>µLearn GECI</Name>
          <span className={cn("mx-1.5", light ? "text-amber-300/80" : "text-gold")}>·</span>
          <CreditCopy light={light} />
        </p>
      ) : (
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
            Project developed by
          </p>
          <p
            className={cn(
              "text-lg font-bold tracking-tight",
              light ? "text-white" : "text-emerald-950",
            )}
          >
            µLearn GECI
          </p>
          <p className="mt-1 text-xs leading-snug">
            <CreditCopy light={light} />
          </p>
        </div>
      )}
    </div>
  );
}
