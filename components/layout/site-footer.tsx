import { cn } from "@/lib/utils";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto border-t border-emerald-900/20 bg-emerald-950 text-white", className)}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mulearn-logo.png"
            alt="µLearn IDK"
            className="h-8 w-auto shrink-0 rounded-md bg-black object-contain ring-1 ring-amber-300/35"
          />
          <p className="truncate text-xs sm:text-sm">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Project developed by
            </span>{" "}
            <span className="font-semibold">µLearn GECI</span>
          </p>
        </div>
        <p className="hidden min-w-0 truncate text-right text-xs text-emerald-100/90 sm:block">
          <span className="font-semibold text-white">Prof. Rejin R</span>
          <span className="mx-1.5 text-emerald-400">·</span>
          Asst. Professor in IT
          <span className="mx-1.5 text-emerald-400">·</span>
          <span className="font-medium text-amber-200">Campus Lead Enabler, µLearn GECI</span>
        </p>
      </div>
    </footer>
  );
}
