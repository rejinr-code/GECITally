import { cn } from "@/lib/utils";

export function GeciMark({ className }: { className?: string }) {
  return (
    // Official GECI crest — local public asset
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/geci-logo.png"
      alt="Government Engineering College Idukki"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

export function BrandLockup({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <GeciMark className={compact ? "size-9" : "size-12"} />
      <div className="leading-tight">
        <p className={cn("font-semibold tracking-tight", light ? "text-white" : "text-foreground")}>
          GECI Tally
        </p>
        {!compact && (
          <p className={cn("text-xs", light ? "text-emerald-100" : "text-muted-foreground")}>
            Government Engineering College Idukki
          </p>
        )}
      </div>
    </div>
  );
}
