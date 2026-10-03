import Link from "next/link";
import { CountingReportView } from "@/components/admin/counting-report-view";
import { Button } from "@/components/ui/button";
import { buildCountingReport } from "@/lib/counting-report";
import { slashDate, todayIsoDate } from "@/lib/result-report";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Candidate, CountEntry, CountRound, Election, Post, Profile } from "@/lib/types";

export async function CountingReportScreen() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Counting report</h1>
        <p className="text-muted-foreground">No election is configured yet.</p>
        <Button asChild variant="outline">
          <Link href="/admin">Back</Link>
        </Button>
      </div>
    );
  }

  const [{ data: posts }, { data: people }] = await Promise.all([
    admin.from("posts").select("*").eq("election_id", election.id).order("display_order"),
    admin.from("profiles").select("id, full_name, role, created_at"),
  ]);
  const postIds = (posts ?? []).map((post) => post.id);
  const [{ data: candidates }, { data: rounds }] = postIds.length
    ? await Promise.all([
        admin
          .from("candidates")
          .select("id, post_id, name, photo_url, panel_id, panel_name, branch, year, display_order")
          .in("post_id", postIds)
          .order("display_order"),
        admin
          .from("count_rounds")
          .select("id, post_id, staff_id, round_number, status, submitted_at, invalid_votes, invalid_slot_votes")
          .in("post_id", postIds)
          .order("round_number"),
      ])
    : [
        { data: [] as Candidate[] },
        { data: [] as CountRound[] },
      ];

  const roundIds = (rounds ?? []).map((round) => round.id);
  const { data: entries } = roundIds.length
    ? await admin.from("count_entries").select("round_id, candidate_id, votes, slot_votes").in("round_id", roundIds)
    : { data: [] as CountEntry[] };

  const report = buildCountingReport({
    election: election as Election,
    posts: (posts ?? []) as Post[],
    candidates: (candidates ?? []) as Candidate[],
    rounds: (rounds ?? []) as CountRound[],
    entries: (entries ?? []) as CountEntry[],
    people: (people ?? []) as Profile[],
    issuedOn: slashDate(todayIsoDate()),
  });

  if (report.sheets.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Counting report</h1>
          <p className="mt-1 text-muted-foreground">
            Reports appear after Counting Supervisors submit rounds. Rejected rounds are not printed.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">Back</Link>
        </Button>
      </div>
    );
  }

  return <CountingReportView report={report} />;
}
