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
import { cn, formatNumber } from "@/lib/utils";

const INVALID_KEY = "__invalid__";

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
};

function emptyTally(candidates: Candidate[]) {
  return {
    ...Object.fromEntries(candidates.map((candidate) => [candidate.id, 0])),
    [INVALID_KEY]: 0,
  };
}

function pendingTotalOf(pendingAdds: Record<string, number>) {
  return Object.values(pendingAdds).reduce((sum, value) => sum + value, 0);
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
}: Props) {
  const [votes, setVotes] = useState<Record<string, number>>(() => emptyTally(candidates));
  const [pendingAdds, setPendingAdds] = useState<Record<string, number>>({});
  const [lastId, setLastId] = useState<string | null>(null);
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
  const invalidCount = votes[INVALID_KEY] ?? 0;
  const committedTotal = rows.reduce((sum, row) => sum + row.votes, 0) + invalidCount;
  const pendingTotal = pendingTotalOf(pendingAdds);
  const total = committedTotal + pendingTotal;
  const waitingOnSupervisor = requireSupervisor && Boolean(pendingRound);
  const blocked = waitingOnSupervisor || !countingOpen || postComplete;
  const canCount = !blocked && !isSubmitting && total < roundCap;
  const canConfirmQueued = !blocked && !isSubmitting && pendingTotal > 0;
  const roundFull = roundCap > 0 && total >= roundCap;
  const canSubmit =
    !blocked &&
    !isSubmitting &&
    pendingTotal === 0 &&
    committedTotal > 0 &&
    (exactRoundRequired ? committedTotal === roundCap : committedTotal <= roundSize);

  function queueVote(candidateId: string) {
    if (!canCount) return;
    setError(null);
    setPendingAdds((current) => ({
      ...current,
      [candidateId]: (current[candidateId] ?? 0) + 1,
    }));
    setLastId(candidateId);
  }

  function clearQueued() {
    setPendingAdds({});
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
    setPendingAdds({});
    if (nextTotal >= roundCap && roundCap > 0) {
      setLimitOpen(true);
    }
  }

  function openSubmit() {
    if (pendingTotal > 0 || !canSubmit) return;
    setError(null);
    setLimitOpen(false);
    setSubmitOpen(true);
  }

  function openSubmitFromLimit() {
    setLimitOpen(false);
    setError(null);
    setSubmitOpen(true);
  }

  function recountRound() {
    if (isSubmitting) return;
    setSubmitOpen(false);
    setLimitOpen(false);
    setPendingAdds({});
    setVotes(emptyTally(candidates));
    setLastId(null);
    setError(null);
    toast.message("Round cleared. Count this round again.");
  }

  async function confirmSubmit() {
    await run(async () => {
      const result = await submitCountRound(
        postId,
        rows.map((row) => ({
          candidate_id: row.candidate.id,
          votes: row.votes,
        })),
        invalidCount,
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
      setVotes(emptyTally(candidates));
      setLastId(null);
    });
  }

  const lastVoteLabel =
    lastId === INVALID_KEY ? "Invalid" : candidates.find((candidate) => candidate.id === lastId)?.name;

  const tableRows: Array<{
    id: string;
    name: string;
    panel: string;
    classLabel: string | null;
    count: number;
    pending: number;
    invalid: boolean;
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
    {
      id: INVALID_KEY,
      name: "Invalid",
      panel: "Spoilt / rejected",
      classLabel: null,
      count: invalidCount,
      pending: pendingAdds[INVALID_KEY] ?? 0,
      invalid: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Counting now
              </p>
              <CardTitle className="text-2xl">Round {roundNumber}</CardTitle>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Ballots
              </p>
              <p className="text-3xl font-black tabular-nums leading-none text-emerald-800">
                {formatNumber(total)}
                <span className="text-lg font-semibold text-muted-foreground">
                  {roundCap > 0 ? ` / ${formatNumber(roundCap)}` : ""}
                </span>
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Use Vote on a row, then Confirm to mark the count so far. Do not type numbers. Invalid ballots count
            toward the round, not toward a candidate
            {isLastRound ? `. This last round has ${formatNumber(roundCap)} remaining.` : "."}
          </p>
        </div>
        {waitingOnSupervisor && <Badge variant="warning">Awaiting supervisor verification</Badge>}
        {rejectedRound && !waitingOnSupervisor && (
          <Badge variant="destructive">Rejected — re-enter this round</Badge>
        )}
        {isLastRound && !waitingOnSupervisor && !rejectedRound && (
          <Badge variant="outline">Last round</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {rejectedRound?.remarks && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Supervisor remarks: {rejectedRound.remarks}
          </p>
        )}
        {!countingOpen && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Counting is closed. Wait for the admin to open it.
          </p>
        )}
        {postComplete && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            All {formatNumber(votesPolled)} ballots for this post have been counted.
          </p>
        )}

        <div className="flex items-stretch gap-3">
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(5.5rem,0.7fr)_5.5rem_6.5rem] gap-3 border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid">
              <span>Candidate</span>
              <span>Panel</span>
              <span className="text-right">Votes</span>
              <span className="text-right">Add</span>
            </div>
            {tableRows.map((row) => {
              const shown = row.count + row.pending;
              const isLast = row.id === lastId;
              const invalidActive = row.invalid && (row.pending > 0 || isLast);
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1.15fr)_minmax(5.5rem,0.7fr)_5.5rem_6.5rem] sm:px-4",
                    invalidActive && "bg-red-50",
                    row.pending > 0 && !row.invalid && "bg-amber-50",
                    isLast && row.pending === 0 && !row.invalid && "bg-emerald-50/80",
                  )}
                >
                  <p
                    className={cn(
                      "min-w-0 truncate text-base font-semibold leading-tight",
                      invalidActive ? "text-red-900" : "text-emerald-950",
                    )}
                  >
                    {row.name}
                  </p>
                  <p
                    className={cn(
                      "min-w-0 truncate text-sm",
                      invalidActive ? "text-red-700" : "text-muted-foreground",
                    )}
                  >
                    {[row.panel, row.classLabel].filter(Boolean).join(" · ")}
                  </p>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-2xl font-black tabular-nums leading-none",
                        invalidActive ? "text-red-700" : "text-emerald-800",
                      )}
                    >
                      {formatNumber(shown)}
                    </p>
                    {row.pending > 0 ? (
                      <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                        +{formatNumber(row.pending)} queued
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <Button
                      type="button"
                      size="lg"
                      variant={row.invalid ? "destructive" : "default"}
                      disabled={!canCount}
                      className="w-[5.75rem]"
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
                "min-h-[10rem] flex-1 px-3 whitespace-normal",
                roundFull &&
                  canConfirmQueued &&
                  "bg-amber-500 text-emerald-950 hover:bg-amber-400 ring-4 ring-amber-300 ring-offset-2",
              )}
              disabled={!canConfirmQueued}
              onClick={confirmQueued}
            >
              Confirm
            </Button>
            {pendingTotal > 0 ? (
              <button
                type="button"
                className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={clearQueued}
              >
                Clear queued
              </button>
            ) : null}
          </div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Last vote: {lastVoteLabel ?? "—"}
            </p>
            {pendingTotal > 0 ? (
              <p className="text-xs font-medium text-amber-800">
                {formatNumber(pendingTotal)} ballot{pendingTotal === 1 ? "" : "s"} not confirmed yet
              </p>
            ) : null}
            {invalidCount + (pendingAdds[INVALID_KEY] ?? 0) > 0 ? (
              <p className="text-xs font-medium text-red-700">
                {formatNumber(invalidCount + (pendingAdds[INVALID_KEY] ?? 0))} invalid
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
                ? "Confirm these sequential totals. This round will wait for supervisor verification."
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
                  <span className="font-semibold tabular-nums">{formatNumber(row.votes)}</span>
                </li>
              );
            })}
            <li className="flex justify-between gap-4 text-red-700">
              <span>Invalid</span>
              <span className="font-semibold tabular-nums">{formatNumber(invalidCount)}</span>
            </li>
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
