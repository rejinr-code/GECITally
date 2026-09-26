import Link from "next/link";
import { ResultReportComposer } from "@/components/supervisor/result-report-composer";
import { Button } from "@/components/ui/button";
import { buildResultReport, detailsFromElection } from "@/lib/result-report";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Candidate, Election, Post } from "@/lib/types";

export async function ResultReportScreen({ backHref }: { backHref: string }) {
  const admin = createAdminClient();

  const { data: election } = await admin
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!election) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Result declaration</h1>
        <p className="text-muted-foreground">No election is configured yet.</p>
        <Button asChild variant="outline">
          <Link href={backHref}>Back</Link>
        </Button>
      </div>
    );
  }

  const { data: posts } = await admin.from("posts").select("*").eq("election_id", election.id).order("display_order");
  const postIds = (posts ?? []).map((post) => post.id);
  const [{ data: candidates }, { data: rounds }] = postIds.length
    ? await Promise.all([
        admin
          .from("candidates")
          .select("id, post_id, name, photo_url, panel_id, panel_name, branch, year, display_order")
          .in("post_id", postIds)
          .order("display_order"),
        admin.from("count_rounds").select("id, post_id, status, invalid_votes").in("post_id", postIds),
      ])
    : [
        { data: [] as Candidate[] },
        { data: [] as Array<{ id: string; post_id: string; status: string; invalid_votes?: number | null }> },
      ];

  const roundIds = (rounds ?? []).map((round) => round.id);
  const { data: entries } = roundIds.length
    ? await admin.from("count_entries").select("round_id, candidate_id, votes").in("round_id", roundIds)
    : { data: [] as Array<{ round_id: string; candidate_id: string; votes: number }> };

  const report = buildResultReport({
    election: election as Election,
    posts: (posts ?? []) as Post[],
    candidates: (candidates ?? []) as Candidate[],
    rounds: rounds ?? [],
    entries: entries ?? [],
  });

  if (!report.complete) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Result declaration</h1>
          <p className="mt-1 text-muted-foreground">
            The official report can be generated only after counting is finalised for every post that has polled votes.
          </p>
        </div>
        {report.pendingPosts.length > 0 ? (
          <ul className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
            {report.pendingPosts.map((name) => (
              <li key={name} className="ml-4 list-disc">
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
            Counting has not started, or no votes have been recorded yet.
          </p>
        )}
        <Button asChild variant="outline">
          <Link href={backHref}>Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <ResultReportComposer
      backHref={backHref}
      electionId={election.id}
      report={report}
      initialDetails={detailsFromElection(election as Election)}
    />
  );
}
