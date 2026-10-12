import { requireRole } from "@/lib/auth/require-role";
import { HallDisplayScreen } from "@/components/display/hall-display-screen";
import { buildHallDisplayPosts } from "@/lib/hall-display";
import { liveDisplaySettings } from "@/lib/utils";
import type { Candidate, CountEntry, CountRound, Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DisplayControlPage() {
  const { supabase } = await requireRole(["admin", "supervisor"]);

  const { data: election } = await supabase
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: displayReleasedError } = await supabase.from("posts").select("display_released").limit(1);

  const { data: posts } = election
    ? await supabase.from("posts").select("*").eq("election_id", election.id).order("display_order")
    : { data: [] as Post[] };

  const postIds = (posts ?? []).map((post) => post.id);
  const { data: candidates } = postIds.length
    ? await supabase.from("candidates").select("*").in("post_id", postIds).order("display_order")
    : { data: [] as Candidate[] };

  const { data: rounds } = postIds.length
    ? await supabase.from("count_rounds").select("*").in("post_id", postIds)
    : { data: [] as CountRound[] };

  const roundIds = (rounds ?? []).map((round) => round.id);
  const { data: entries } = roundIds.length
    ? await supabase.from("count_entries").select("*").in("round_id", roundIds)
    : { data: [] as CountEntry[] };

  const requireVerification = liveDisplaySettings(election).results_require_verification;
  const countedStatuses: Array<CountRound["status"]> = requireVerification
    ? ["verified"]
    : ["verified", "pending_verification"];

  const snapshots = buildHallDisplayPosts(
    (posts ?? []) as Post[],
    (candidates ?? []) as Candidate[],
    (rounds ?? []) as CountRound[],
    (entries ?? []) as CountEntry[],
    countedStatuses,
  );

  return (
    <HallDisplayScreen
      posts={snapshots}
      countingOpen={election?.state === "counting" || election?.state === "finalised"}
      schemaNeedsDisplayReleased={Boolean(displayReleasedError)}
    />
  );
}
