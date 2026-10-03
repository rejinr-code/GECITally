"use client";

import { useState } from "react";
import { toast } from "sonner";
import { resetElectionCounts, setElectionState, setLiveDisplaySettings, setPollAnnounced, upsertElection } from "@/lib/actions/admin";
import type { Election, ElectionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import { liveDisplaySettings } from "@/lib/utils";
import Link from "next/link";
import { FileText } from "lucide-react";

const STATES: ElectionState[] = ["setup", "counting", "finalised"];

const STATE_COPY: Record<ElectionState, { title: string; detail: string }> = {
  setup: {
    title: "Switch to Setup?",
    detail: "Counting Supervisors will not be able to submit rounds. Posts and candidates can still be edited.",
  },
  counting: {
    title: "Switch to Counting?",
    detail: "Counting Supervisors can enter votes and Returning Officers can verify rounds. The hall will show Counting started until the first totals appear.",
  },
  finalised: {
    title: "Switch to Finalised?",
    detail: "Counting closes. The hall will announce Counting completed, then keep the declared results on the board.",
  },
};

export function ElectionSettings({ election }: { election: Election | null }) {
  const { isSubmitting, run } = useAntiDuplicate();
  const { isSubmitting: stateBusy, run: runState } = useAntiDuplicate();
  const { isSubmitting: displayBusy, run: runDisplay } = useAntiDuplicate();
  const { isSubmitting: resetBusy, run: runReset } = useAntiDuplicate();
  const { isSubmitting: pollBusy, run: runPoll } = useAntiDuplicate();
  const [pendingState, setPendingState] = useState<ElectionState | null>(null);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState<"show" | "hide" | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const display = liveDisplaySettings(election);
  const [rotateSeconds, setRotateSeconds] = useState(String(display.results_rotate_seconds));
  const [requireVerification, setRequireVerification] = useState(display.results_require_verification);
  const [countingRequireVerification, setCountingRequireVerification] = useState(
    display.counting_require_verification,
  );

  function openStateDialog(state: ElectionState) {
    if (!election || election.state === state) return;
    setDisplayOpen(false);
    setResetOpen(false);
    setPollOpen(null);
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
    setResetOpen(false);
    setPollOpen(null);
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

  function openResetDialog() {
    if (!election) return;
    setPendingState(null);
    setDisplayOpen(false);
    setPollOpen(null);
    setPassword("");
    setPasswordError(null);
    window.setTimeout(() => setResetOpen(true), 0);
  }

  function closeResetDialog() {
    if (resetBusy) return;
    setResetOpen(false);
    setPassword("");
    setPasswordError(null);
  }

  function confirmReset() {
    if (!election) return;
    void runReset(async () => {
      const result = await resetElectionCounts(election.id, password);
      if (result.error) {
        setPasswordError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Counts reset.");
      setResetOpen(false);
      setPassword("");
      setPasswordError(null);
    });
  }

  function confirmDisplay() {
    if (!election) return;
    const seconds = Number.parseInt(rotateSeconds, 10);
    void runDisplay(async () => {
      const result = await setLiveDisplaySettings(
        election.id,
        seconds,
        requireVerification,
        countingRequireVerification,
        password,
      );
      if (result.error) {
        setPasswordError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Counting and live results settings updated.");
      setDisplayOpen(false);
      setPassword("");
      setPasswordError(null);
    });
  }

  function openPollDialog(mode: "show" | "hide") {
    if (!election || election.state !== "setup") return;
    setPendingState(null);
    setDisplayOpen(false);
    setResetOpen(false);
    setPassword("");
    setPasswordError(null);
    window.setTimeout(() => setPollOpen(mode), 0);
  }

  function closePollDialog() {
    if (pollBusy) return;
    setPollOpen(null);
    setPassword("");
    setPasswordError(null);
  }

  function confirmPoll() {
    if (!election || !pollOpen) return;
    void runPoll(async () => {
      const result = await setPollAnnounced(election.id, pollOpen === "show", password);
      if (result.error) {
        setPasswordError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(pollOpen === "show" ? "Hall is showing poll completed." : "Hall poll announcement hidden.");
      setPollOpen(null);
      setPassword("");
      setPasswordError(null);
    });
  }

  return (
    <div className="space-y-6">
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
              <Label htmlFor="count_limit">Ballots per round (N)</Label>
              <Input
                id="count_limit"
                name="count_limit"
                type="number"
                min={1}
                defaultValue={election?.count_limit ?? 8}
              />
              <p className="text-xs text-muted-foreground">
                Each counting round has N ballots. Counting Supervisors get a prompt when the round reaches N.
                The last round may have fewer remaining ballots. A post locks when its votes polled
                are fully counted.
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
          {election?.state === "setup" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-950">Public hall before counting</p>
              <p className="mt-1 text-xs text-emerald-800">
                {election.poll_announced
                  ? "The hall is showing Poll completed and Counting to be started soon. Switch to Counting when the count opens."
                  : "Announce the poll on the hall before you open counting. Save overall votes polled first."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!election || pollBusy || Boolean(election.poll_announced)}
                  onClick={() => openPollDialog("show")}
                >
                  {pollBusy && pollOpen === "show" ? <Spinner /> : null}
                  Show poll completed
                </Button>
                {election.poll_announced ? (
                  <Button type="button" variant="outline" disabled={pollBusy} onClick={() => openPollDialog("hide")}>
                    {pollBusy && pollOpen === "hide" ? <Spinner /> : null}
                    Hide from hall
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
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
          {election?.state === "finalised" ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-950">Result declaration report</p>
              <p className="mt-1 text-xs text-emerald-800">
                Counting is closed. Generate the official college result declaration for print or PDF.
              </p>
              <Button asChild className="mt-3">
                <Link href="/admin/report">
                  <FileText />
                  Generate report
                </Link>
              </Button>
            </div>
          ) : null}
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Reset all counts</p>
            <p className="mt-1 text-xs text-red-700">
              Deletes every submitted round and returns the election to setup. This cannot be undone.
              Confirm with your admin password.
            </p>
            <Button
              className="mt-3"
              type="button"
              variant="destructive"
              disabled={!election || resetBusy}
              onClick={openResetDialog}
            >
              {resetBusy ? <Spinner /> : null}
              Reset counts
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Counting and live results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These settings change how Counting Supervisors count and what the hall display board shows. Saving them
            requires your admin password.
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
              <legend className="text-sm font-medium">Proceed counting</legend>
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="counting_approval_mode"
                  className="mt-1"
                  checked={countingRequireVerification}
                  onChange={() => setCountingRequireVerification(true)}
                  disabled={!election || !requireVerification}
                />
                <span>
                  <span className="font-medium">With Returning Officer approval</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Counting Supervisors wait after each round until a Returning Officer verifies it.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="counting_approval_mode"
                  className="mt-1"
                  checked={!countingRequireVerification}
                  onChange={() => setCountingRequireVerification(false)}
                  disabled={!election}
                />
                <span>
                  <span className="font-medium">Without Returning Officer approval</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Each submitted round is accepted immediately so the next round can start.
                    Rounds already waiting are accepted too.
                  </span>
                </span>
              </label>
            </fieldset>
            <fieldset className="space-y-2 md:col-span-2">
              <legend className="text-sm font-medium">When to show vote totals</legend>
              <div className="grid gap-2 md:grid-cols-2">
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
                  <span className="font-medium">After Returning Officer approval</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Hall results only include verified rounds.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="results_display_mode"
                  className="mt-1"
                  checked={!requireVerification}
                  onChange={() => {
                    setRequireVerification(false);
                    setCountingRequireVerification(false);
                  }}
                  disabled={!election}
                />
                <span>
                  <span className="font-medium">Directly after a Counting Supervisor submits</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Pending rounds appear immediately. Counting Supervisors can start the next round without waiting
                    for a Returning Officer. Rejected rounds are removed.
                  </span>
                </span>
              </label>
              </div>
            </fieldset>
          </div>
          <Button type="button" disabled={!election || displayBusy} onClick={openDisplayDialog}>
            {displayBusy ? <Spinner /> : null}
            Save counting and display
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
      ) : null}

      {displayOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="display-confirm-title"
            className="w-full max-w-md rounded-xl border bg-white p-6 shadow-2xl"
          >
            <h2 id="display-confirm-title" className="text-lg font-semibold">
              Update counting and live results?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Counting will proceed {countingRequireVerification ? "with" : "without"} Returning Officer
              approval. Posts will rotate every {rotateSeconds || "—"} seconds. Vote totals will show{" "}
              {requireVerification ? "only after Returning Officer approval" : "directly after a Counting Supervisor submits"}.
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
                  Confirm
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {resetOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            className="w-full max-w-md rounded-xl border bg-white p-6 shadow-2xl"
          >
            <h2 id="reset-confirm-title" className="text-lg font-semibold">
              Reset all counts?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This deletes every submitted round and returns the election to setup. It cannot be
              undone. Enter your admin password, then confirm.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                confirmReset();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="reset-password">Admin password</Label>
                <Input
                  id="reset-password"
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
                <Button type="button" variant="outline" disabled={resetBusy} onClick={closeResetDialog}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={resetBusy || !password.trim()}>
                  {resetBusy ? <Spinner /> : null}
                  Reset counts
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pollOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="poll-confirm-title"
            className="w-full max-w-md rounded-xl border bg-white p-6 shadow-2xl"
          >
            <h2 id="poll-confirm-title" className="text-lg font-semibold">
              {pollOpen === "show" ? "Show poll completed on the hall?" : "Hide poll announcement from the hall?"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pollOpen === "show"
                ? `The public view will show Poll completed with ${election?.total_votes_polled ?? 0} votes polled, then Counting to be started soon. Counting stays closed until you switch to Counting.`
                : "The hall will stop showing the poll-completed message until you announce it again."}{" "}
              Enter your admin password, then confirm.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                confirmPoll();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="poll-password">Admin password</Label>
                <Input
                  id="poll-password"
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
                <Button type="button" variant="outline" disabled={pollBusy} onClick={closePollDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pollBusy || !password.trim()}>
                  {pollBusy ? <Spinner /> : null}
                  {pollOpen === "show" ? "Show on hall" : "Hide from hall"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
