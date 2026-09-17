"use client";

import type { Candidate, Election, Panel, Post, Profile } from "@/lib/types";
import { ElectionSettings } from "@/components/admin/election-settings";
import { PanelManager } from "@/components/admin/panel-manager";
import { PostEditor } from "@/components/admin/post-editor";
import { StaffManager } from "@/components/admin/staff-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PostWithCandidates = Post & { candidates: Candidate[] };
type StaffRow = Profile & { assigned_post_ids: string[] };

export function AdminConsole({
  election,
  electionId,
  panels,
  posts,
  people,
  countingStarted,
  schemaNeedsUpdate,
  schemaNeedsCandidateClass,
}: {
  election: Election | null;
  electionId: string | null;
  panels: Panel[];
  posts: PostWithCandidates[];
  people: StaffRow[];
  countingStarted: boolean;
  schemaNeedsUpdate: boolean;
  schemaNeedsCandidateClass: boolean;
}) {
  return (
    <div className="space-y-6">
      {schemaNeedsUpdate && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Run <code className="font-medium">supabase/migrations/0002_panels_and_post_votes.sql</code> in
          the Supabase SQL editor to enable panels and per-post votes polled.
        </p>
      )}
      {schemaNeedsCandidateClass && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Run <code className="font-medium">supabase/migrations/0004_candidate_year.sql</code> in
          the Supabase SQL editor to save each candidate&apos;s branch and year.
        </p>
      )}
      <Tabs defaultValue="election">
        <TabsList>
          <TabsTrigger value="election">Election</TabsTrigger>
          <TabsTrigger value="panels">Panels</TabsTrigger>
          <TabsTrigger value="posts">Posts & candidates</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>
        <TabsContent value="election">
          <ElectionSettings election={election} />
        </TabsContent>
        <TabsContent value="panels">
          <PanelManager electionId={electionId} panels={panels} />
        </TabsContent>
        <TabsContent value="posts">
          <PostEditor
            electionId={electionId}
            posts={posts}
            panels={panels}
            countingStarted={countingStarted}
          />
        </TabsContent>
        <TabsContent value="people">
          <StaffManager posts={posts} people={people} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
