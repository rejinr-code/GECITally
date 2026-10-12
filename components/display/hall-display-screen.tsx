"use client";

import { toast } from "sonner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import { setPostDisplayRelease } from "@/lib/actions/display";
import { hallDisplayLeaders, type HallDisplayPost } from "@/lib/hall-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatNumber, ordinalMark } from "@/lib/utils";

export function HallDisplayScreen({
  posts,
  countingOpen,
  schemaNeedsDisplayReleased,
}: {
  posts: HallDisplayPost[];
  countingOpen: boolean;
  schemaNeedsDisplayReleased: boolean;
}) {
  const counted = posts.filter((post) => post.countedBallots > 0);
  const onHall = counted.filter((post) => post.displayReleased).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Hall display</h1>
        <p className="mt-1 text-muted-foreground">
          Counted results stay off the public live board until you forward them. The hall then shows that post with
          its current totals.
        </p>
      </div>

      {schemaNeedsDisplayReleased ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Run <code className="font-medium">supabase/migrations/0021_display_released.sql</code> in the Supabase SQL
          editor first so the hall waits for a forward.
        </p>
      ) : null}

      {!countingOpen ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Open counting before forwarding results to the hall.
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {counted.length} post{counted.length === 1 ? "" : "s"} counted so far
        {counted.length > 0 ? ` · ${onHall} on the hall` : ""}.
      </p>

      {posts.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No posts configured yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((post) => (
            <HallDisplayCard key={post.id} post={post} countingOpen={countingOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function HallDisplayCard({ post, countingOpen }: { post: HallDisplayPost; countingOpen: boolean }) {
  const { isSubmitting, run } = useAntiDuplicate();
  const hasResult = post.countedBallots > 0;
  const { elected, tied } = hallDisplayLeaders(post);
  const electedIds = new Set(elected.map((row) => row.id));
  const tiedIds = new Set(tied.map((row) => row.id));
  const multiSeat = post.seats > 1;

  async function act(release: boolean) {
    const result = await run(async () => setPostDisplayRelease(post.id, release));
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(release ? `${post.name} forwarded to the hall.` : `${post.name} held from the hall.`);
  }

  return (
    <Card className={post.displayReleased ? "border-emerald-300 bg-emerald-50/60" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{post.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {post.votesPolled > 0
              ? `${formatNumber(post.countedBallots)}/${formatNumber(post.votesPolled)} ballots counted`
              : `${formatNumber(post.countedBallots)} ballots counted`}
            {post.rounds > 0 ? ` · ${post.rounds} round${post.rounds === 1 ? "" : "s"}` : ""}
            {post.seats > 1 ? ` · ${post.seats} seats` : ""}
          </p>
        </div>
        {post.displayReleased ? (
          <Badge variant="success">On hall</Badge>
        ) : hasResult ? (
          <Badge variant="warning">Ready</Badge>
        ) : (
          <Badge variant="outline">Not counted</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasResult ? (
          <ul className="space-y-2 text-sm">
            {post.candidates.map((candidate) => (
              <li key={candidate.id} className="flex justify-between gap-4">
                <span>
                  {candidate.name}
                  {candidate.classLabel || candidate.panel ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[candidate.panel, candidate.classLabel].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                  {post.finalised && electedIds.has(candidate.id) ? (
                    <span className="ml-2 rounded bg-amber-300 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-emerald-950">
                      ELECTED
                    </span>
                  ) : null}
                  {post.finalised && tiedIds.has(candidate.id) ? (
                    <span className="ml-2 rounded bg-sky-200 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-sky-950">
                      TIE
                    </span>
                  ) : null}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(candidate.votes)}
                  {multiSeat && candidate.slotVotes.length > 1 ? (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      {candidate.slotVotes.map((count, slot) => `${ordinalMark(slot)} ${formatNumber(count)}`).join(" · ")}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
            {multiSeat
              ? post.invalidSlots.map((count, slot) => (
                  <li key={`invalid-${slot}`} className="flex justify-between gap-4 text-red-700">
                    <span>Invalid {ordinalMark(slot)}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(count)}</span>
                  </li>
                ))
              : (
                  <li className="flex justify-between gap-4 text-red-700">
                    <span>Invalid</span>
                    <span className="font-semibold tabular-nums">{formatNumber(post.invalid)}</span>
                  </li>
                )}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No counted result yet.</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {post.displayReleased ? (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => void act(false)}>
              {isSubmitting ? <Spinner /> : null}
              Hold from display
            </Button>
          ) : (
            <Button type="button" disabled={!countingOpen || !hasResult || isSubmitting} onClick={() => void act(true)}>
              {isSubmitting ? <Spinner /> : null}
              Forward to display
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
