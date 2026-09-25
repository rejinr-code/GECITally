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
  const [lastId, setLastId] = useState<string | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
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
  const total = rows.reduce((sum, row) => sum + row.votes, 0) + invalidCount;
  const waitingOnSupervisor = requireSupervisor && Boolean(pendingRound);
  const blocked = waitingOnSupervisor || !countingOpen || postComplete;
  const canCount = !blocked && !isSubmitting && total < roundCap;
  const canSubmit =
    !blocked &&
    !isSubmitting &&
    !pendingCandidateId &&
    total > 0 &&
    (exactRoundRequired ? total === roundCap : total <= roundSize);

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
    const nextTotal = total + 1;
    setVotes((current) => ({ ...current, [candidateId]: (current[candidateId] ?? 0) + 1 }));
    setLastId(candidateId);
    setPendingCandidateId(null);
    if (nextTotal >= roundCap && roundCap > 0) {
      setLimitOpen(true);
    }
  }

  function openSubmit() {
    if (pendingCandidateId || !canSubmit) return;
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
    setPendingCandidateId(null);
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
      setPendingCandidateId(null);
      setVotes(emptyTally(candidates));
      setLastId(null);
    });
  }

  const lastVoteLabel =
    lastId === INVALID_KEY ? "Invalid" : candidates.find((candidate) => candidate.id === lastId)?.name;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Round {roundNumber}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Add vote on a candidate or Invalid, then Confirm on the same card. Count goes up by one. Do not type
            numbers. Each round is {formatNumber(roundSize)} ballots
            {isLastRound ? `; this last round has ${formatNumber(roundCap)} remaining.` : "."} Invalid ballots
            count toward the round, not toward a candidate.
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

        <div className="flex gap-3 overflow-x-auto pb-1">
          {rows.map(({ candidate, votes: count }) => {
            const classLabel = candidateClassLabel(candidate.branch, candidate.year, candidate.semester);
            return (
              <BallotCard
                key={candidate.id}
                title={candidate.name}
                subtitle={candidate.panel_name || "Independent"}
                badge={classLabel}
                count={count}
                isLast={candidate.id === lastId}
                isPending={pendingCandidateId === candidate.id}
                canCount={canCount}
                onAdd={() => requestAdd(candidate.id)}
                onConfirm={() => confirmAdd(candidate.id)}
                onCancel={cancelPending}
              />
            );
          })}
          <BallotCard
            title="Invalid"
            subtitle="Spoilt / rejected ballot"
            count={invalidCount}
            isLast={lastId === INVALID_KEY}
            isPending={pendingCandidateId === INVALID_KEY}
            canCount={canCount}
            tone="invalid"
            onAdd={() => requestAdd(INVALID_KEY)}
            onConfirm={() => confirmAdd(INVALID_KEY)}
            onCancel={cancelPending}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Ballots this round:{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(total)}
                {roundCap > 0 ? ` / ${formatNumber(roundCap)}` : ""}
              </span>
              {invalidCount > 0 ? (
                <span className="ml-2 text-xs font-medium text-red-700">
                  ({formatNumber(invalidCount)} invalid)
                </span>
              ) : null}
            </p>
            {lastId ? <p className="text-xs text-muted-foreground">Last vote: {lastVoteLabel}</p> : null}
          </div>
          <Button type="button" onClick={openSubmit} disabled={!canSubmit}>
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
                ? `This last round has ${formatNumber(total)} ballots, which is all that remain for this post.`
                : `This round has reached the set count of ${formatNumber(roundSize)} ballots.`}{" "}
              Review and submit this round.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" onClick={recountRound}>
              Recount
            </Button>
            <Button type="button" variant="outline" onClick={() => setLimitOpen(false)}>
              Close
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
          <p className="border-t pt-3 text-sm font-semibold">Total ballots: {formatNumber(total)}. Confirm?</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={recountRound}>
              Recount
            </Button>
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

function BallotCard({
  title,
  subtitle,
  badge,
  count,
  isLast,
  isPending,
  canCount,
  tone,
  onAdd,
  onConfirm,
  onCancel,
}: {
  title: string;
  subtitle: string;
  badge?: string | null;
  count: number;
  isLast: boolean;
  isPending: boolean;
  canCount: boolean;
  tone?: "invalid";
  onAdd: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <article
      className={cn(
        "min-w-[16.5rem] flex-1 rounded-2xl border bg-white p-4 shadow-sm transition",
        tone === "invalid" && "border-red-300 bg-red-50",
        isPending && "border-amber-400 ring-2 ring-amber-200",
        isLast && !isPending && tone === "invalid" && "border-red-500 ring-2 ring-red-200",
        isLast && !isPending && tone !== "invalid" && "border-emerald-500 ring-2 ring-emerald-200",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-lg font-semibold leading-tight", tone === "invalid" && "text-red-900")}>
            {title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {badge ? (
              <Badge variant="outline" className="font-semibold tracking-wide">
                {badge}
              </Badge>
            ) : null}
            <span className={cn("text-xs", tone === "invalid" ? "text-red-700/80" : "text-muted-foreground")}>
              {subtitle}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              tone === "invalid" ? "text-red-700" : "text-emerald-800",
            )}
          >
            {formatNumber(count)}
          </p>
          {isPending ? (
            <p className="text-xs font-medium text-amber-700">→ {formatNumber(count + 1)}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="lg"
          variant={isPending ? "outline" : tone === "invalid" ? "destructive" : "default"}
          disabled={!canCount}
          onClick={onAdd}
        >
          Add vote
        </Button>
        <Button
          type="button"
          size="lg"
          variant={isPending ? "default" : "secondary"}
          disabled={!canCount || !isPending}
          onClick={onConfirm}
        >
          Confirm
        </Button>
      </div>
      {isPending ? (
        <button
          type="button"
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={onCancel}
        >
          Cancel this vote
        </button>
      ) : null}
    </article>
  );
}
