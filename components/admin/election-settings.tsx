"use client";

import { useState } from "react";
import { toast } from "sonner";
import { resetElectionCounts, setElectionState, setLiveDisplaySettings, upsertElection } from "@/lib/actions/admin";
import type { Election, ElectionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import { liveDisplaySettings } from "@/lib/utils";

const STATES: ElectionState[] = ["setup", "counting", "finalised"];

const STATE_COPY: Record<ElectionState, { title: string; detail: string }> = {
  setup: {
    title: "Switch to Setup?",
    detail: "Counting staff will not be able to submit rounds. Posts and candidates can still be edited.",
  },
  counting: {
    title: "Switch to Counting?",
    detail: "Staff can enter votes and supervisors can verify rounds. Configuration edits stay limited.",
  },
  finalised: {
    title: "Switch to Finalised?",
    detail: "Counting closes. Verified totals stay on the live results board.",
  },
};

export function ElectionSettings({ election }: { election: Election | null }) {
  const { isSubmitting, run } = useAntiDuplicate();
  const { isSubmitting: stateBusy, run: runState } = useAntiDuplicate();
  const { isSubmitting: displayBusy, run: runDisplay } = useAntiDuplicate();
  const [resetting, setResetting] = useState(false);
  const [pendingState, setPendingState] = useState<ElectionState | null>(null);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const display = liveDisplaySettings(election);
  const [rotateSeconds, setRotateSeconds] = useState(String(display.results_rotate_seconds));
  const [requireVerification, setRequireVerification] = useState(display.results_require_verification);

  function openStateDialog(state: ElectionState) {
    if (!election || election.state === state) return;
    setDisplayOpen(false);
    setPassword("");
    setPasswordError(null);
    setPendingState(state);
  }

  function closeStateDialog() {
    if (stateBusy) return;
    setPendingState(null);
    setPassword("");
    setPasswordError(null);
  }

  function openDisplayDialog() {
    if (!election) return;
    setPendingState(null);
    setPassword("");
    setPasswordError(null);
    window.setTimeout(() => setDisplayOpen(true), 0);
  }

  function closeDisplayDialog() {
    if (displayBusy) return;
    setDisplayOpen(false);
    setPassword("");
    setPasswordError(null);
  }

  function confirmState() {
    if (!election || !pendingState) return;
    void runState(async () => {
      const result = await setElectionState(election.id, pendingState, password);
      if (result.error) {
        setPasswordError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Election is now ${pendingState}.`);
      setPendingState(null);
      setPassword("");
      setPasswordError(null);
    });
  }

  function confirmDisplay() {
    if (!election) return;
    const seconds = Number.parseInt(rotateSeconds, 10);
    void runDisplay(async () => {
      const result = await setLiveDisplaySettings(election.id, seconds, requireVerification, password);
      if (result.error) {
        setPasswordError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Live results display updated.");
      setDisplayOpen(false);
      setPassword("");
      setPasswordError(null);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Election metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void run(async () => {
                const result = await upsertElection(new FormData(form));
                if (result.error) toast.error(result.error);
                else toast.success("Election saved.");
              });
            }}
          >
            {election?.id && <input type="hidden" name="id" value={election.id} />}
            <div className="space-y-2">
              <Label htmlFor="name">Election name</Label>
              <Input id="name" name="name" defaultValue={election?.name ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={election?.date ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_votes_polled">Overall votes polled</Label>
              <Input
                id="total_votes_polled"
                name="total_votes_polled"
                type="number"
                min={0}
                defaultValue={election?.total_votes_polled ?? 0}
              />
              <p className="text-xs text-muted-foreground">
                Optional election-wide summary. Each post also needs its own votes polled — that
                figure is what the live results screen uses.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="count_limit">Count finalisation limit (N)</Label>
              <Input
                id="count_limit"
                name="count_limit"
                type="number"
                min={1}
                defaultValue={election?.count_limit ?? 8}
              />
              <p className="text-xs text-muted-foreground">
                After N verified rounds for a post, those totals lock. Raise this mid-election for remaining ballots.
              </p>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Save election
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Election state</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current state: <span className="font-semibold capitalize text-foreground">{election?.state ?? "none"}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {STATES.map((state) => (
              <Button
                key={state}
                type="button"
                variant={election?.state === state ? "default" : "outline"}
                disabled={!election || stateBusy}
                className="capitalize"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  window.setTimeout(() => openStateDialog(state), 0);
                }}
              >
                {stateBusy && pendingState === state ? <Spinner /> : null}
                {state}
              </Button>
            ))}
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Reset all counts</p>
            <p className="mt-1 text-xs text-red-700">
              Deletes every submitted round and returns the election to setup. This cannot be undone.
            </p>
            <Button
              className="mt-3"
              type="button"
              variant="destructive"
              disabled={!election || resetting}
              onClick={() => {
                if (!election) return;
                if (!window.confirm("Reset all counts? This cannot be undone.")) return;
                setResetting(true);
                void resetElectionCounts(election.id).then((result) => {
                  setResetting(false);
                  if (result.error) toast.error(result.error);
                  else toast.success("Counts reset.");
                });
              }}
            >
              {resetting ? <Spinner /> : null}
              Reset counts
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Live results display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These settings change the public hall board. Saving them requires your admin password.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="results_rotate_seconds">Post rotate delay (seconds)</Label>
              <Input
                id="results_rotate_seconds"
                type="number"
                min={5}
                max={120}
                value={rotateSeconds}
                onChange={(event) => setRotateSeconds(event.target.value)}
                disabled={!election}
              />
              <p className="text-xs text-muted-foreground">
                How long each post stays on the live board before the next one. From 5 to 120 seconds.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">When to show vote totals</legend>
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="results_display_mode"
                  className="mt-1"
                  checked={requireVerification}
                  onChange={() => setRequireVerification(true)}
                  disabled={!election}
                />
                <span>
                  <span className="font-medium">After supervisor approval</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Public results only include verified rounds.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="results_display_mode"
                  className="mt-1"
                  checked={!requireVerification}
                  onChange={() => setRequireVerification(false)}
                  disabled={!election}
                />
                <span>
                  <span className="font-medium">Directly after staff submit</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Pending rounds appear immediately. Rejected rounds are removed.
                  </span>
                </span>
              </label>
            </fieldset>
          </div>
          <Button type="button" disabled={!election || displayBusy} onClick={openDisplayDialog}>
            {displayBusy ? <Spinner /> : null}
            Save live display
          </Button>
        </CardContent>
      </Card>

      {pendingState ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="state-confirm-title"
            className="w-full max-w-md rounded-xl border bg-white p-6 shadow-2xl"
          >
            <h2 id="state-confirm-title" className="text-lg font-semibold">
              {STATE_COPY[pendingState].title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {STATE_COPY[pendingState].detail} Enter your admin password, then confirm.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                confirmState();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="state-password">Admin password</Label>
                <Input
                  id="state-password"
                  type="password"
                  autoComplete="off"
                  value={password}
                  autoFocus
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  required
                />
              </div>
              {passwordError ? <p className="text-sm text-red-700">{passwordError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" disabled={stateBusy} onClick={closeStateDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="capitalize" disabled={stateBusy || !password.trim()}>
                  {stateBusy ? <Spinner /> : null}
                  Confirm {pendingState}
                </Button>
              </div>
            </form>
          </div>
        </div>
      {displayOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="display-confirm-title"
            className="w-full max-w-md rounded-xl border bg-white p-6 shadow-2xl"
          >
            <h2 id="display-confirm-title" className="text-lg font-semibold">
              Update live results display?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Posts will rotate every {rotateSeconds || "—"} seconds. Vote totals will show{" "}
              {requireVerification ? "only after supervisor approval" : "directly after staff submit"}.
              Enter your admin password, then confirm.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                confirmDisplay();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="display-password">Admin password</Label>
                <Input
                  id="display-password"
                  type="password"
                  autoComplete="off"
                  value={password}
                  autoFocus
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  required
                />
              </div>
              {passwordError ? <p className="text-sm text-red-700">{passwordError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" disabled={displayBusy} onClick={closeDisplayDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={displayBusy || !password.trim()}>
                  {displayBusy ? <Spinner /> : null}
                  Confirm display
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
