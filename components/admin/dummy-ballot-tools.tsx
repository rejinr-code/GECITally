"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { randomizeDummyPolled } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";

export function DummyBallotTools({
  electionId,
  countingStarted,
}: {
  electionId: string;
  countingStarted: boolean;
}) {
  const router = useRouter();
  const { isSubmitting, run } = useAntiDuplicate();
  const [minBallots, setMinBallots] = useState("18");
  const [maxBallots, setMaxBallots] = useState("32");
  const [password, setPassword] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dummy ballots for a counting drill</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Assign a random votes-polled turnout to every post that has candidates, then print pre-marked dummy
          ballot papers. Counting Supervisors can count those papers in the live desks.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dummy-min">Min ballots</Label>
            <Input
              id="dummy-min"
              type="number"
              min={1}
              max={200}
              value={minBallots}
              onChange={(event) => setMinBallots(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dummy-max">Max ballots</Label>
            <Input
              id="dummy-max"
              type="number"
              min={1}
              max={200}
              value={maxBallots}
              onChange={(event) => setMaxBallots(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dummy-password">Admin password</Label>
            <Input
              id="dummy-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isSubmitting || countingStarted}
            onClick={() => {
              void run(async () => {
                const result = await randomizeDummyPolled(
                  electionId,
                  Number.parseInt(minBallots, 10),
                  Number.parseInt(maxBallots, 10),
                  password,
                );
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setPassword("");
                toast.success(`Votes polled set to ${result.turnout} on ${result.posts} posts.`);
              });
            }}
          >
            {isSubmitting ? <Spinner /> : null}
            Set random votes polled
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/admin/dummy-ballots")}>
            Print dummy ballots
          </Button>
        </div>
        {countingStarted ? (
          <p className="text-xs text-amber-800">
            Reset counts before drawing a new dummy turnout. You can still print ballots for the current votes
            polled.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
