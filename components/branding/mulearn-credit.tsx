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
  if (compact) {
    return (
      <div className="flex h-full flex-col justify-center bg-[#c9a227] px-2 py-1 text-slate-950">
        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-900">
          Project Developed By
        </p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mulearn-logo.png"
            alt="µLearn IDK"
            className="size-8 shrink-0 rounded-md bg-black object-contain ring-1 ring-black/20"
          />
          <div className="min-w-0 leading-[1.15]">
            <p className="truncate text-[11px] font-black tracking-tight">µLearn GECI</p>
            <p className="truncate text-[10px] font-semibold">Prof. Rejin R</p>
            <p className="truncate text-[9px] font-semibold text-slate-800">Campus Lead Enabler</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-3.5 rounded-2xl border px-3.5 py-2.5",
        light
          ? "border-amber-300/25 bg-gradient-to-r from-white/12 to-transparent"
          : "border-emerald-200/90 bg-white shadow-[0_10px_28px_-18px_rgba(4,120,87,0.55)]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mulearn-logo.png"
        alt="µLearn IDK"
        className={cn(
          "h-12 w-auto shrink-0 rounded-lg bg-black object-contain ring-1",
          light ? "ring-amber-300/40" : "ring-gold/40",
        )}
      />
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
    </div>
  );
}
