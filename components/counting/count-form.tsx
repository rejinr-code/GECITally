"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import { submitCountRound } from "@/lib/actions/counting";
import type { Candidate, CountRound } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { candidateClassLabel } from "@/lib/candidate-class";
import {
  ballotMarkCount,
  cn,
  formatNumber,
  invalidSlotKey,
  marksToBallots,
  ordinalMark,
  percent,
  resolveSeats,
  competitionRank,
  rankByVotesThenName,
} from "@/lib/utils";

const INVALID_KEY = "__invalid__";

const SLOT_THEME = [
  {
    bar: "bg-emerald-600",
    panel: "border-emerald-300 bg-emerald-50",
    text: "text-emerald-900",
    muted: "text-emerald-800",
    chip: "bg-emerald-700 text-white",
    vote: "bg-emerald-700 text-white hover:bg-emerald-800",
    last: "bg-emerald-50/90",
  },
  {
    bar: "bg-sky-600",
    panel: "border-sky-300 bg-sky-50",
    text: "text-sky-950",
    muted: "text-sky-800",
    chip: "bg-sky-600 text-white",
    vote: "bg-sky-600 text-white hover:bg-sky-700",
    last: "bg-sky-50",
  },
  {
    bar: "bg-violet-600",
    panel: "border-violet-300 bg-violet-50",
    text: "text-violet-950",
    muted: "text-violet-800",
    chip: "bg-violet-700 text-white",
    vote: "bg-violet-700 text-white hover:bg-violet-800",
    last: "bg-violet-50",
  },
] as const;

function slotTheme(slot: number) {
  return SLOT_THEME[slot] ?? SLOT_THEME[SLOT_THEME.length - 1];
}

type CountResult = {
  entries: Array<{ candidate_id: string; votes: number; slot_votes?: number[] }>;
  invalid: number;
  invalidSlots: number[];
};

type Props = {
  postId: string;
  postName: string;
  roundNumber: number;
  candidates: Candidate[];
  pendingRound: CountRound | null;
  rejectedRound: CountRound | null;
  countingOpen: boolean;
  requireSupervisor: boolean;
  roundSize: number;
  votesPolled: number;
  countedBallots: number;
  seats?: number;
  result?: CountResult;
};

function emptyTally(candidates: Candidate[], seats: number) {
  const tally: Record<string, number> = Object.fromEntries(
    candidates.map((candidate) => [candidate.id, 0]),
  );
  if (seats <= 1) {
    tally[INVALID_KEY] = 0;
  } else {
    for (let slot = 0; slot < seats; slot += 1) {
      tally[invalidSlotKey(slot)] = 0;
    }
  }
  return tally;
}

function pendingTotalOf(pendingAdds: Record<string, number>) {
  return Object.values(pendingAdds).reduce((sum, value) => sum + value, 0);
}

function emptyDraft(seats: number) {
  return Array.from({ length: Math.max(seats, 1) }, () => null as string | null);
}

function emptySlotMap(candidates: Candidate[], seats: number) {
  return Object.fromEntries(
    candidates.map((candidate) => [candidate.id, Array.from({ length: Math.max(seats, 1) }, () => 0)]),
  ) as Record<string, number[]>;
}

export function CountForm({
  postId,
  postName,
  roundNumber,
  candidates,
  pendingRound,
  rejectedRound,
  countingOpen,
  requireSupervisor,
  roundSize,
  votesPolled,
  countedBallots,
  seats = 1,
  result,
}: Props) {
  const marksPerBallot = ballotMarkCount(seats);
  const multiSeat = marksPerBallot > 1;
  const [votes, setVotes] = useState<Record<string, number>>(() => emptyTally(candidates, marksPerBallot));
  const [pendingAdds, setPendingAdds] = useState<Record<string, number>>({});
  const [candidateSlots, setCandidateSlots] = useState<Record<string, number[]>>(() =>
    emptySlotMap(candidates, marksPerBallot),
  );
  const [pendingCandidateSlots, setPendingCandidateSlots] = useState<Record<string, number[]>>(() =>
    emptySlotMap(candidates, marksPerBallot),
  );
  const [draft, setDraft] = useState<(string | null)[]>(() => emptyDraft(marksPerBallot));
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, run } = useAntiDuplicate();

  const remaining = votesPolled > 0 ? Math.max(0, votesPolled - countedBallots) : null;
  const roundCap = remaining === null ? roundSize : Math.min(roundSize, remaining);
  const postComplete = remaining === 0;
  const isLastRound = remaining !== null && remaining > 0 && remaining < roundSize;
  const exactRoundRequired = remaining !== null;

  const rows = useMemo(
    () => candidates.map((candidate) => ({ candidate, votes: votes[candidate.id] ?? 0 })),
    [candidates, votes],
  );
  const invalidSlots = multiSeat
    ? Array.from({ length: marksPerBallot }, (_, slot) => votes[invalidSlotKey(slot)] ?? 0)
    : [votes[INVALID_KEY] ?? 0];
  const invalidCount = invalidSlots.reduce((sum, value) => sum + value, 0);
  const committedMarks = rows.reduce((sum, row) => sum + row.votes, 0) + invalidCount;
  const pendingMarks = pendingTotalOf(pendingAdds);
  const committedTotal = marksToBallots(committedMarks, marksPerBallot);
  const pendingTotal = marksToBallots(pendingMarks, marksPerBallot);
  const fillingBallot = multiSeat && draft.some(Boolean);
  const currentSlot = multiSeat ? draft.findIndex((slot) => slot == null) : 0;
  const activeSlot = multiSeat ? Math.max(currentSlot, 0) : 0;
  const theme = slotTheme(activeSlot);
  const waitingOnSupervisor = requireSupervisor && Boolean(pendingRound);
  const blocked = waitingOnSupervisor || !countingOpen || postComplete;
  const canCount = !blocked && !isSubmitting && (fillingBallot || committedTotal < roundCap);
  const canConfirmQueued = !blocked && !isSubmitting && pendingTotal > 0 && !fillingBallot;
  const roundFull = roundCap > 0 && committedTotal + pendingTotal >= roundCap;
  const canSubmit =
    !blocked &&
    !isSubmitting &&
    pendingTotal === 0 &&
    !fillingBallot &&
    committedTotal > 0 &&
    (exactRoundRequired ? committedTotal === roundCap : committedTotal <= roundSize);

  function queueVote(candidateId: string) {
    if (!canCount) return;
    setError(null);

    if (!multiSeat) {
      setPendingAdds({ [candidateId]: 1 });
      setLastId(candidateId);
      setLastSlot(0);
      return;
    }

    if (pendingTotal > 0 && !fillingBallot) {
      setError("Confirm this ballot first.");
      return;
    }

    const slot = currentSlot < 0 ? 0 : currentSlot;
    const isInvalidMark = candidateId.startsWith("__invalid_");
    if (isInvalidMark && candidateId !== invalidSlotKey(slot)) {
      setError(`Cast the ${ordinalMark(slot)} vote on this ballot first.`);
      return;
    }
    if (!isInvalidMark && draft.includes(candidateId)) {
      setError("This candidate is already marked on this ballot.");
      return;
    }

    const next = [...draft];
    next[slot] = candidateId;
    setLastId(candidateId);
    setLastSlot(slot);
    if (next.every(Boolean)) {
      setPendingAdds(() => {
        const queued: Record<string, number> = {};
        for (const id of next) {
          if (!id) continue;
          queued[id] = (queued[id] ?? 0) + 1;
        }
        return queued;
      });
      setPendingCandidateSlots(() => {
        const queued = emptySlotMap(candidates, marksPerBallot);
        next.forEach((id, slot) => {
          if (!id || id.startsWith("__invalid")) return;
          const marks = [...(queued[id] ?? Array.from({ length: marksPerBallot }, () => 0))];
          marks[slot] = (marks[slot] ?? 0) + 1;
          queued[id] = marks;
        });
        return queued;
      });
      setDraft(emptyDraft(marksPerBallot));
    } else {
      setDraft(next);
    }
  }

  function clearQueued() {
    setPendingAdds({});
    setPendingCandidateSlots(emptySlotMap(candidates, marksPerBallot));
    setDraft(emptyDraft(marksPerBallot));
    setError(null);
  }

  function confirmQueued() {
    if (!canConfirmQueued) return;
    const nextTotal = committedTotal + pendingTotal;
    setVotes((current) => {
      const next = { ...current };
      for (const [id, extra] of Object.entries(pendingAdds)) {
        if (extra > 0) next[id] = (next[id] ?? 0) + extra;
      }
      return next;
    });
    setCandidateSlots((current) => {
      const next = { ...current };
      for (const [id, marks] of Object.entries(pendingCandidateSlots)) {
        next[id] = (next[id] ?? Array.from({ length: marksPerBallot }, () => 0)).map(
          (value, slot) => value + (marks[slot] ?? 0),
        );
      }
      return next;
    });
    setPendingAdds({});
    setPendingCandidateSlots(emptySlotMap(candidates, marksPerBallot));
    if (nextTotal >= roundCap && roundCap > 0) {
      setLimitOpen(true);
    }
  }

  function openSubmit() {
    if (pendingTotal > 0 || fillingBallot || !canSubmit) return;
    setError(null);
    setLimitOpen(false);
    setSubmitOpen(true);
  }

  function openSubmitFromLimit() {
    setLimitOpen(false);
    if (pendingTotal > 0 || fillingBallot || !canSubmit) return;
    setError(null);
    setSubmitOpen(true);
  }

  function recountRound() {
    if (isSubmitting) return;
    setSubmitOpen(false);
    setLimitOpen(false);
    setPendingAdds({});
    setPendingCandidateSlots(emptySlotMap(candidates, marksPerBallot));
    setDraft(emptyDraft(marksPerBallot));
    setVotes(emptyTally(candidates, marksPerBallot));
    setCandidateSlots(emptySlotMap(candidates, marksPerBallot));
    setLastId(null);
    setLastSlot(null);
    setError(null);
    toast.message("Round cleared. Count this round again.");
  }

  async function confirmSubmit() {
    await run(async () => {
      const slotVotes = multiSeat ? invalidSlots : undefined;
      const result = await submitCountRound(
        postId,
        rows.map((row) => ({
          candidate_id: row.candidate.id,
          votes: row.votes,
          ...(multiSeat ? { slot_votes: candidateSlots[row.candidate.id] ?? [] } : {}),
        })),
        invalidCount,
        slotVotes,
      );
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(
        requireSupervisor
          ? `Round ${roundNumber} submitted for verification.`
          : `Round ${roundNumber} accepted. You can start the next round.`,
      );
      setSubmitOpen(false);
      setLimitOpen(false);
      setPendingAdds({});
      setPendingCandidateSlots(emptySlotMap(candidates, marksPerBallot));
      setDraft(emptyDraft(marksPerBallot));
      setVotes(emptyTally(candidates, marksPerBallot));
      setCandidateSlots(emptySlotMap(candidates, marksPerBallot));
      setLastId(null);
      setLastSlot(null);
    });
  }

  function labelForId(id: string | null) {
    if (!id) return null;
    if (id === INVALID_KEY) return "Invalid";
    if (id.startsWith("__invalid_")) {
      const slot = Number(id.replace("__invalid_", "").replace("__", ""));
      return Number.isFinite(slot) ? `Invalid ${ordinalMark(slot)}` : "Invalid";
    }
    return candidates.find((candidate) => candidate.id === id)?.name ?? null;
  }

  const lastVoteLabel = labelForId(lastId);

  const tableRows: Array<{
    id: string;
    name: string;
    panel: string;
    classLabel: string | null;
    count: number;
    pending: number;
    invalid: boolean;
    slot?: number;
  }> = [
    ...rows.map(({ candidate, votes: count }) => ({
      id: candidate.id,
      name: candidate.name,
      panel: candidate.panel_name || "Independent",
      classLabel: candidateClassLabel(candidate.branch, candidate.year, candidate.semester),
      count,
      pending: pendingAdds[candidate.id] ?? 0,
      invalid: false,
    })),
    ...(multiSeat
      ? invalidSlots.map((count, slot) => ({
          id: invalidSlotKey(slot),
          name: `Invalid ${ordinalMark(slot)}`,
          panel: "Spoilt / rejected",
          classLabel: null,
          count,
          pending: pendingAdds[invalidSlotKey(slot)] ?? 0,
          invalid: true,
          slot,
        }))
      : [
          {
            id: INVALID_KEY,
            name: "Invalid",
            panel: "Spoilt / rejected",
            classLabel: null,
            count: invalidSlots[0] ?? 0,
            pending: pendingAdds[INVALID_KEY] ?? 0,
            invalid: true,
            slot: 0,
          },
        ]),
  ];
  const compact = tableRows.length >= 6;
  const countingFinished = postComplete && !waitingOnSupervisor;

  if (countingFinished) {
    const tallies = new Map((result?.entries ?? []).map((entry) => [entry.candidate_id, entry]));
    const ranked = rankByVotesThenName(
      [...candidates].map((candidate) => ({
        candidate,
        votes: tallies.get(candidate.id)?.votes ?? 0,
        slot_votes: tallies.get(candidate.id)?.slot_votes,
      })),
      (row) => row.votes,
      (row) => row.candidate.name,
    );
    const { elected, tied } = resolveSeats(ranked, seats, (row) => row.votes);
    const electedIds = new Set(elected.map((row) => row.candidate.id));
    const tiedIds = new Set(tied.map((row) => row.candidate.id));
    const invalidSlots = result?.invalidSlots && result.invalidSlots.length > 1 ? result.invalidSlots : null;
    const invalidTotal = result?.invalid ?? 0;
    const candidateVotes = ranked.reduce((sum, row) => sum + row.votes, 0);

    return (
      <Card className="flex h-full min-h-0 flex-col gap-2 py-3">
        <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 px-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Counting done
            </p>
            <CardTitle className="text-xl">Results · {postName}</CardTitle>
          </div>
          <Badge className="bg-emerald-700 text-white">Done</Badge>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-2 px-4">
          <p className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            All {formatNumber(votesPolled)} ballots have been counted. No further rounds are needed.
            {tied.length > 0
              ? ` ${tied.length} candidates are tied for the remaining seat${seats - elected.length === 1 ? "" : "s"}.`
              : ""}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-emerald-100">
            {ranked.map((row, index) => {
              const elected = electedIds.has(row.candidate.id);
              const tiedForSeat = tiedIds.has(row.candidate.id);
              const classLabel = candidateClassLabel(
                row.candidate.branch,
                row.candidate.year,
                row.candidate.semester,
              );
              const share = percent(row.votes, candidateVotes);
              const rank = competitionRank(ranked, index, (item) => item.votes);
              return (
                <div
                  key={row.candidate.id}
                  className={cn(
                    "flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0 sm:grid sm:grid-cols-[2rem_minmax(0,1fr)_auto]",
                    elected && "bg-amber-50",
                    tiedForSeat && "bg-sky-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums",
                      elected
                        ? "bg-amber-300 text-emerald-950"
                        : tiedForSeat
                          ? "bg-sky-200 text-sky-950"
                          : "bg-emerald-100 text-emerald-800",
                    )}
                  >
                    {rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-emerald-950">
                      {row.candidate.name}
                      {elected ? (
                        <span className="ml-2 rounded bg-amber-300 px-1.5 py-0.5 text-[9px] font-black tracking-[0.16em] text-emerald-950">
                          ELECTED
                        </span>
                      ) : null}
                      {tiedForSeat ? (
                        <span className="ml-2 rounded bg-sky-200 px-1.5 py-0.5 text-[9px] font-black tracking-[0.16em] text-sky-950">
                          TIE
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[row.candidate.panel_name || "Independent", classLabel].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-xl font-black tabular-nums leading-none",
                        elected ? "text-amber-700" : tiedForSeat ? "text-sky-800" : "text-emerald-800",
                      )}
                    >
                      {formatNumber(row.votes)}
                    </p>
                    {multiSeat &&
                    (row.slot_votes?.length ?? 0) > 1 &&
                    row.slot_votes!.reduce((sum, count) => sum + count, 0) === row.votes ? (
                      <p className="mt-0.5 text-[9px] font-semibold tabular-nums">
                        {row.slot_votes!.map((count, slot) => (
                          <span key={slot} className={cn(slot === 0 ? "text-emerald-700" : "text-sky-700")}>
                            {slot > 0 ? " · " : null}
                            {ordinalMark(slot)} {formatNumber(count)}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] tabular-nums text-emerald-600">{share}% share</p>
                    )}
                  </div>
                </div>
              );
            })}
            {invalidSlots
              ? invalidSlots.map((votes, slot) => (
                  <div
                    key={`invalid-${slot}`}
                    className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-3 py-1.5"
                  >
                    <p className="text-sm font-semibold text-red-900">Invalid {ordinalMark(slot)}</p>
                    <p className="text-xl font-black tabular-nums text-red-700">{formatNumber(votes)}</p>
                  </div>
                ))
              : (
                  <div className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-3 py-1.5">
                    <p className="text-sm font-semibold text-red-900">Invalid</p>
                    <p className="text-xl font-black tabular-nums text-red-700">{formatNumber(invalidTotal)}</p>
                  </div>
                )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full min-h-0", compact && "gap-2 py-3")}>
      <CardHeader className={cn("flex shrink-0 flex-row items-start justify-between gap-3", compact && "px-4")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Counting now
              </p>
              <CardTitle className={compact ? "text-xl" : "text-2xl"}>Round {roundNumber}</CardTitle>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Ballots
              </p>
              <p
                className={cn(
                  "font-black tabular-nums leading-none text-emerald-800",
                  compact ? "text-2xl" : "text-3xl",
                )}
              >
                {formatNumber(committedTotal)}
                <span className="text-lg font-semibold text-muted-foreground">
                  {roundCap > 0 ? ` / ${formatNumber(roundCap)}` : ""}
                </span>
              </p>
            </div>
          </div>
          {!compact ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {multiSeat
                ? `Each ballot names ${marksPerBallot} candidates. Vote a candidate for the ${ordinalMark(0)} mark, then another for the ${ordinalMark(1)}${marksPerBallot > 2 ? ", and so on" : ""}. If a mark is spoilt, use that mark's Invalid row instead. The same candidate cannot be marked twice.`
                : "Use Vote on a row, then Confirm that one vote. Do not type numbers. Invalid ballots count toward the round, not toward a candidate"}
              {isLastRound ? `. This last round has ${formatNumber(roundCap)} remaining.` : multiSeat ? "" : "."}
            </p>
          ) : isLastRound ? (
            <p className="mt-1 text-xs text-muted-foreground">
              This last round has {formatNumber(roundCap)} remaining.
            </p>
          ) : null}
          {multiSeat && !blocked && !postComplete ? (
            <div className={cn("mt-2 overflow-hidden rounded-xl border", theme.panel)}>
              <div className={cn("h-1.5", theme.bar)} />
              <div className={cn("px-3", compact ? "py-1.5" : "py-2.5")}>
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: marksPerBallot }, (_, slot) => {
                  const slotStyle = slotTheme(slot);
                  const filled = Boolean(draft[slot]);
                  const current = slot === activeSlot;
                  return (
                    <span
                      key={slot}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
                        current ? slotStyle.chip : "bg-white/80 text-slate-500",
                      )}
                    >
                      {ordinalMark(slot)}
                      {filled ? (
                        <span className="normal-case tracking-normal font-semibold">
                          {labelForId(draft[slot])}
                        </span>
                      ) : current ? (
                        <span className="normal-case tracking-normal font-semibold">now</span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              <p className={cn(compact ? "mt-1 text-xs font-semibold" : "mt-2 text-sm font-semibold", theme.text)}>
                Select the {ordinalMark(activeSlot)} candidate
                {fillingBallot ? " on this ballot" : " on the next ballot"}. Use Invalid{" "}
                {ordinalMark(activeSlot)} only if that mark is spoilt.
              </p>
              </div>
            </div>
          ) : null}
        </div>
        {waitingOnSupervisor && <Badge variant="warning">Awaiting Returning Officer verification</Badge>}
        {rejectedRound && !waitingOnSupervisor && (
          <Badge variant="destructive">Rejected — re-enter this round</Badge>
        )}
        {isLastRound && !waitingOnSupervisor && !rejectedRound && (
          <Badge variant="outline">Last round</Badge>
        )}
        {postComplete && waitingOnSupervisor ? (
          <Badge className="bg-emerald-700 text-white">All ballots in</Badge>
        ) : null}
      </CardHeader>
      <CardContent className={cn("flex min-h-0 flex-1 flex-col", compact ? "space-y-2 px-4" : "space-y-4")}>
        {rejectedRound?.remarks && (
          <p className={cn("rounded-md bg-red-50 text-sm text-red-800", compact ? "px-3 py-1.5" : "px-3 py-2")}>
            Returning Officer remarks: {rejectedRound.remarks}
          </p>
        )}
        {!countingOpen && (
          <p className={cn("rounded-md bg-amber-50 text-sm text-amber-800", compact ? "px-3 py-1.5" : "px-3 py-2")}>
            Counting is closed. Wait for the admin to open it.
          </p>
        )}
        {postComplete && waitingOnSupervisor ? (
          <p className={cn("rounded-md bg-emerald-50 text-sm text-emerald-800", compact ? "px-3 py-1.5" : "px-3 py-2")}>
            All {formatNumber(votesPolled)} ballots are in. Counting is done after Returning Officer
            verification.
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 items-stretch gap-3">
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border",
              multiSeat && theme.panel,
            )}
          >
            <div
              className={cn(
                "hidden shrink-0 grid-cols-[minmax(0,1.15fr)_minmax(5.5rem,0.7fr)_5.5rem_4.75rem] gap-3 border-b px-4 text-[11px] font-semibold uppercase tracking-[0.16em] sm:grid",
                compact ? "py-1" : "py-2",
                multiSeat ? cn("border-transparent", theme.muted) : "bg-slate-50 text-muted-foreground",
              )}
            >
              <span>Candidate</span>
              <span>Panel</span>
              <span className="text-right">Votes</span>
              <span className="text-right">Add</span>
            </div>
            {tableRows.map((row) => {
              const shown = row.count;
              const isLast = row.id === lastId;
              const invalidActive = row.invalid && isLast;
              const alreadyOnBallot = multiSeat && !row.invalid && draft.includes(row.id);
              const wrongInvalidSlot = Boolean(
                multiSeat && row.invalid && typeof row.slot === "number" && row.slot !== currentSlot,
              );
              const voteDisabled =
                !canCount ||
                alreadyOnBallot ||
                wrongInvalidSlot ||
                (multiSeat && pendingTotal > 0 && !fillingBallot);
              const lastTheme = lastSlot != null ? slotTheme(lastSlot) : null;
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center gap-3 border-b last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1.15fr)_minmax(5.5rem,0.7fr)_5.5rem_4.75rem]",
                    compact ? "min-h-[2.15rem] flex-1 px-3 py-0.5 sm:px-3" : "px-3 py-2 sm:px-4",
                    invalidActive && "bg-red-50",
                    isLast && !row.invalid && (lastTheme?.last ?? "bg-emerald-50/80"),
                    alreadyOnBallot && "opacity-60",
                    multiSeat && "border-white/70",
                  )}
                >
                  <p
                    className={cn(
                      "min-w-0 truncate font-semibold leading-tight",
                      compact ? "text-sm" : "text-base",
                      invalidActive ? "text-red-900" : "text-emerald-950",
                    )}
                  >
                    {row.name}
                  </p>
                  <p
                    className={cn(
                      "min-w-0 truncate",
                      compact ? "text-xs" : "text-sm",
                      invalidActive ? "text-red-700" : "text-muted-foreground",
                    )}
                  >
                    {[row.panel, row.classLabel].filter(Boolean).join(" · ")}
                  </p>
                  <div className={cn("shrink-0 text-right", compact && "flex items-baseline justify-end gap-1.5")}>
                    <p
                      className={cn(
                        "font-black tabular-nums leading-none",
                        compact ? "text-xl" : "text-2xl",
                        invalidActive ? "text-red-700" : "text-emerald-800",
                      )}
                    >
                      {formatNumber(shown)}
                    </p>
                    {multiSeat && !row.invalid ? (
                      <p className={cn("font-semibold tabular-nums", compact ? "text-[9px]" : "mt-0.5 text-[10px]")}>
                        {(candidateSlots[row.id] ?? []).map((count, slot) => {
                          const pending = pendingCandidateSlots[row.id]?.[slot] ?? 0;
                          return (
                            <span key={slot} className={cn(slot === 0 ? "text-emerald-700" : "text-sky-700")}>
                              {slot > 0 ? " · " : null}
                              {ordinalMark(slot)} {formatNumber(count + pending)}
                            </span>
                          );
                        })}
                      </p>
                    ) : row.pending > 0 ? (
                      <p className={cn("font-semibold text-amber-700", compact ? "text-[10px]" : "mt-0.5 text-[11px]")}>
                        +1 to confirm
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={row.invalid ? "destructive" : "default"}
                      disabled={voteDisabled}
                      className={cn(
                        "h-7 w-[3.75rem] px-2 text-xs",
                        !row.invalid && multiSeat && theme.vote,
                      )}
                      onClick={() => queueVote(row.id)}
                    >
                      Vote
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex w-[7.75rem] shrink-0 flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className={cn(
                "flex-1 px-3 whitespace-normal",
                compact ? "min-h-0" : "min-h-[10rem]",
                roundFull &&
                  canConfirmQueued &&
                  "bg-amber-500 text-emerald-950 hover:bg-amber-400 ring-4 ring-amber-300 ring-offset-2",
              )}
              disabled={!canConfirmQueued}
              onClick={confirmQueued}
            >
              Confirm
            </Button>
            {pendingTotal > 0 || fillingBallot ? (
              <button
                type="button"
                className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={clearQueued}
              >
                Clear vote
              </button>
            ) : null}
          </div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Last vote:{" "}
              {lastVoteLabel ? (
                <>
                  {multiSeat && lastSlot != null ? (
                    <span className={cn("mr-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide", slotTheme(lastSlot).chip)}>
                      {ordinalMark(lastSlot)}
                    </span>
                  ) : null}
                  {lastVoteLabel}
                </>
              ) : (
                "—"
              )}
            </p>
            {pendingTotal > 0 ? (
              <p className="text-xs font-medium text-amber-800">
                {multiSeat
                  ? "1 ballot not confirmed yet"
                  : "1 vote not confirmed yet"}
              </p>
            ) : null}
            {invalidCount +
              (multiSeat
                ? invalidSlots.reduce((sum, _, slot) => sum + (pendingAdds[invalidSlotKey(slot)] ?? 0), 0)
                : pendingAdds[INVALID_KEY] ?? 0) >
            0 ? (
              <p className="text-xs font-medium text-red-700">
                {multiSeat
                  ? invalidSlots
                      .map((count, slot) => {
                        const pending = pendingAdds[invalidSlotKey(slot)] ?? 0;
                        return `Invalid ${ordinalMark(slot)}: ${formatNumber(count + pending)}`;
                      })
                      .join(" · ")
                  : `${formatNumber(invalidCount + (pendingAdds[INVALID_KEY] ?? 0))} invalid`}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            className={cn(canSubmit && roundFull && "ring-2 ring-emerald-500 ring-offset-2")}
            onClick={openSubmit}
            disabled={!canSubmit}
          >
            Review and submit
          </Button>
        </div>
      </CardContent>

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isLastRound ? "Last round complete" : "Round count reached"}
            </DialogTitle>
            <DialogDescription>
              {isLastRound
                ? `This last round has ${formatNumber(committedTotal)} ballots, which is all that remain for this post.`
                : `This round has reached the set count of ${formatNumber(roundSize)} ballots.`}{" "}
              Review and submit this round.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" onClick={recountRound}>
              Recount
            </Button>
            <Button type="button" onClick={openSubmitFromLimit}>
              Review and submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={(value) => !isSubmitting && setSubmitOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Round {roundNumber} — {postName}
            </DialogTitle>
            <DialogDescription>
              {requireSupervisor
                ? "Confirm these sequential totals. This round will wait for Returning Officer verification."
                : "Confirm these sequential totals. This round will be accepted immediately."}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {rows.map((row) => {
              const classLabel = candidateClassLabel(row.candidate.branch, row.candidate.year, row.candidate.semester);
              return (
                <li key={row.candidate.id} className="flex justify-between gap-4">
                  <span>
                    {row.candidate.name}
                    {classLabel ? <span className="ml-2 text-xs text-muted-foreground">{classLabel}</span> : null}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatNumber(row.votes)}
                    {multiSeat ? (
                      <span className="ml-2 text-xs font-medium text-muted-foreground">
                        {(candidateSlots[row.candidate.id] ?? []).map((count, slot) => (
                          <span key={slot}>
                            {slot > 0 ? " · " : null}
                            {ordinalMark(slot)} {formatNumber(count)}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {multiSeat
              ? invalidSlots.map((count, slot) => (
                  <li key={invalidSlotKey(slot)} className="flex justify-between gap-4 text-red-700">
                    <span>Invalid {ordinalMark(slot)}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(count)}</span>
                  </li>
                ))
              : (
                  <li className="flex justify-between gap-4 text-red-700">
                    <span>Invalid</span>
                    <span className="font-semibold tabular-nums">{formatNumber(invalidCount)}</span>
                  </li>
                )}
          </ul>
          <p className="border-t pt-3 text-sm font-semibold">Total ballots: {formatNumber(committedTotal)}. Confirm?</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={recountRound}>
              Recount
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={() => void confirmSubmit()}>
              {isSubmitting ? <Spinner /> : null}
              {isSubmitting ? "Saving..." : "Confirm round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
