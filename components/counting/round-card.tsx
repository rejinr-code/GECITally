import type { CountEntry, CountRound } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

const STATUS: Record<CountRound["status"], string> = {
  pending_verification: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

export function RoundCard({
  round,
  entries,
  invalidVotes,
  seats = 1,
}: {
  round: CountRound;
  entries: Array<CountEntry & { candidate_name: string }>;
  invalidVotes?: number;
  seats?: number;
}) {
  const invalid = invalidVotes ?? round.invalid_votes ?? 0;
  const total = entries.reduce((sum, entry) => sum + entry.votes, 0) + invalid;
  const ranked = [...entries].sort((a, b) => b.votes - a.votes);
  const cutoff = ranked[Math.max(0, seats - 1)]?.votes ?? 0;
  const winners = new Set(
    ranked.filter((entry) => entry.votes > 0 && entry.votes >= cutoff).map((entry) => entry.candidate_id),
  );

  return (
    <div className="border-b border-border/70 py-2.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">
          Round {round.round_number}
          <span
            className={cn(
              "ml-2 text-xs font-normal",
              round.status === "rejected" && "text-red-700",
              round.status === "pending_verification" && "text-amber-700",
              round.status === "verified" && "text-muted-foreground",
            )}
          >
            {STATUS[round.status]}
          </span>
        </p>
        <p className="text-sm font-semibold tabular-nums">{formatNumber(total)}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {entries.map((entry, index) => (
          <span key={entry.id}>
            {index > 0 ? " · " : null}
            <span
              className={cn(
                winners.has(entry.candidate_id) && "font-semibold text-emerald-800",
              )}
            >
              {entry.candidate_name} {formatNumber(entry.votes)}
            </span>
          </span>
        ))}
        <span>
          {" · "}
          Invalid {formatNumber(invalid)}
        </span>
      </p>
      {round.remarks ? <p className="mt-1 text-xs text-red-700">{round.remarks}</p> : null}
    </div>
  );
}
