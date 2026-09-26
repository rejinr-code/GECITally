export default function StaffLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border bg-muted/60" />
        <div className="h-40 animate-pulse rounded-xl border bg-muted/60" />
      </div>
    </div>
  );
}
