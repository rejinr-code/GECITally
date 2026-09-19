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

type Props = {
  postId: string;
  postName: string;
  roundNumber: number;
  candidates: Candidate[];
  pendingRound: CountRound | null;
  rejectedRound: CountRound | null;
  countingOpen: boolean;
  limitReached: boolean;
};

function emptyTally(candidates: Candidate[]) {
  return Object.fromEntries(candidates.map((candidate) => [candidate.id, 0]));
}

export function CountForm({
  postId,
  postName,
  roundNumber,
  candidates,
  pendingRound,
  rejectedRound,
  countingOpen,
  limitReached,
}: Props) {
  const [votes, setVotes] = useState<Record<string, number>>(() => emptyTally(candidates));
  const [lastId, setLastId] = useState<string | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, run } = useAntiDuplicate();

  const rows = useMemo(
    () => candidates.map((candidate) => ({ candidate, votes: votes[candidate.id] ?? 0 })),
    [candidates, votes],
  );
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  const blocked = Boolean(pendingRound) || !countingOpen || (limitReached && !rejectedRound);
  const canCount = !blocked && !isSubmitting;

  function requestAdd(candidateId: string) {
    if (!canCount) return;
    setError(null);
    setPendingCandidateId(candidateId);
  }

  function cancelPending() {
    setPendingCandidateId(null);
  }

  function confirmAdd(candidateId: string) {
    if (!canCount || pendingCandidateId !== candidateId) return;
    setVotes((current) => ({ ...current, [candidateId]: (current[candidateId] ?? 0) + 1 }));
    setLastId(candidateId);
    setPendingCandidateId(null);
  }

  function openSubmit() {
    if (pendingCandidateId) return;
    setError(null);
    setSubmitOpen(true);
  }

  async function confirmSubmit() {
    await run(async () => {
      const result = await submitCountRound(
        postId,
        rows.map((row) => ({
          candidate_id: row.candidate.id,
          votes: row.votes,
        })),
      );
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Round ${roundNumber} submitted for verification.`);
      setSubmitOpen(false);
      setPendingCandidateId(null);
      setVotes(emptyTally(candidates));
      setLastId(null);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Round {roundNumber}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Add vote on a candidate, then Confirm on the same card. Count goes up by one. Do not type numbers.
          </p>
        </div>
        {pendingRound && <Badge variant="warning">Awaiting supervisor verification</Badge>}
        {rejectedRound && !pendingRound && <Badge variant="destructive">Rejected — re-enter this round</Badge>}
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
        {limitReached && !rejectedRound && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            This post has reached the finalisation limit. Ask the admin to raise it for remaining ballots.
          </p>
        )}

        <div className="flex gap-3 overflow-x-auto pb-1">
          {rows.map(({ candidate, votes: count }) => {
            const classLabel = candidateClassLabel(candidate.branch, candidate.year, candidate.semester);
            const isLast = candidate.id === lastId;
            const isPending = pendingCandidateId === candidate.id;
            return (
              <article
                key={candidate.id}
                className={cn(
                  "min-w-[16.5rem] flex-1 rounded-2xl border bg-white p-4 shadow-sm transition",
                  isPending && "border-amber-400 ring-2 ring-amber-200",
                  isLast && !isPending && "border-emerald-500 ring-2 ring-emerald-200",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold leading-tight">{candidate.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {classLabel ? (
                        <Badge variant="outline" className="font-semibold tracking-wide">
                          {classLabel}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {candidate.panel_name || "Independent"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-semibold tabular-nums text-emerald-800">
                      {formatNumber(count)}
                    </p>
                    {isPending ? (
                      <p className="text-xs font-medium text-amber-700">
                        → {formatNumber(count + 1)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="lg"
                    variant={isPending ? "outline" : "default"}
                    disabled={!canCount}
                    onClick={() => requestAdd(candidate.id)}
                  >
                    Add vote
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={isPending ? "default" : "secondary"}
                    disabled={!canCount || !isPending}
                    onClick={() => confirmAdd(candidate.id)}
                  >
                    Confirm
                  </Button>
                </div>
                {isPending ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={cancelPending}
                  >
                    Cancel this vote
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Ballots counted: <span className="font-semibold text-foreground">{formatNumber(total)}</span>
            </p>
            {lastId ? (
              <p className="text-xs text-muted-foreground">
                Last vote: {candidates.find((candidate) => candidate.id === lastId)?.name}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={openSubmit}
            disabled={blocked || isSubmitting || total === 0 || Boolean(pendingCandidateId)}
          >
            Review and submit
          </Button>
        </div>
      </CardContent>

      <Dialog open={submitOpen} onOpenChange={(value) => !isSubmitting && setSubmitOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Round {roundNumber} — {postName}
            </DialogTitle>
            <DialogDescription>
              Confirm these sequential totals. This round will wait for supervisor verification.
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
          </ul>
          <p className="border-t pt-3 text-sm font-semibold">Total ballots: {formatNumber(total)}. Confirm?</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setSubmitOpen(false)}>
              Cancel
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
