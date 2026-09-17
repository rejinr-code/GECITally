import { cn } from "@/lib/utils";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto border-t border-emerald-900/20 bg-emerald-950 text-white", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:py-8">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mulearn-logo.png"
            alt="µLearn IDK"
            className="h-16 w-auto shrink-0 rounded-lg bg-black object-contain ring-1 ring-amber-300/35"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
              Project developed by
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">µLearn GECI</p>
          </div>
        </div>
        <div className="sm:max-w-md sm:text-right">
          <p className="text-base font-semibold tracking-tight">Prof. Rejin R</p>
          <p className="mt-0.5 text-sm text-emerald-100/85">Asst. Professor in IT</p>
          <p className="text-sm font-medium text-amber-200">Campus Lead Enabler, µLearn GECI</p>
        </div>
      </div>
    </footer>
  );
}
