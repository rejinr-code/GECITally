import type { CountEntry, CountRound } from "@/lib/types";
import { cn, formatNumber, marksToBallots, ordinalMark, resolveSeats } from "@/lib/utils";

const STATUS: Record<CountRound["status"], string> = {
  pending_verification: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

export function RoundCard({
  round,
  entries,
  invalidVotes,
  invalidSlotVotes,
  seats = 1,
  highlightSeats = false,
}: {
  round: CountRound;
  entries: Array<CountEntry & { candidate_name: string }>;
  invalidVotes?: number;
  invalidSlotVotes?: number[];
  seats?: number;
  highlightSeats?: boolean;
}) {
  const invalid = invalidVotes ?? round.invalid_votes ?? 0;
  const slots =
    invalidSlotVotes && invalidSlotVotes.length > 1
      ? invalidSlotVotes
      : round.invalid_slot_votes && round.invalid_slot_votes.length > 1
        ? round.invalid_slot_votes
        : null;
  const totalMarks = entries.reduce((sum, entry) => sum + entry.votes, 0) + invalid;
  const totalBallots = marksToBallots(totalMarks, seats);
  const ranked = [...entries].sort(
    (a, b) => b.votes - a.votes || a.candidate_name.localeCompare(b.candidate_name, "en"),
  );
  const { elected, tied } = highlightSeats
    ? resolveSeats(ranked, seats, (entry) => entry.votes)
    : { elected: [] as typeof ranked, tied: [] as typeof ranked };
  const electedIds = new Set(elected.map((entry) => entry.candidate_id));
  const tiedIds = new Set(tied.map((entry) => entry.candidate_id));

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
        <p className="text-sm font-semibold tabular-nums">{formatNumber(totalBallots)}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {entries.map((entry, index) => (
          <span key={entry.id}>
            {index > 0 ? " · " : null}
            <span
              className={cn(
                electedIds.has(entry.candidate_id) && "font-semibold text-emerald-800",
                tiedIds.has(entry.candidate_id) && "font-semibold text-sky-800",
              )}
            >
              {entry.candidate_name} {formatNumber(entry.votes)}
            </span>
          </span>
        ))}
        <span>
          {" · "}
          {slots
            ? slots.map((count, slot) => `Invalid ${ordinalMark(slot)} ${formatNumber(count)}`).join(" · ")
            : `Invalid ${formatNumber(invalid)}`}
        </span>
      </p>
      {round.remarks ? <p className="mt-1 text-xs text-red-700">{round.remarks}</p> : null}
    </div>
  );
}
