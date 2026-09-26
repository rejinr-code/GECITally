"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PrintDummyBallotsButton } from "@/components/admin/print-dummy-ballots-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dummyBallotSeed, generateDummyBallots, type DummyPostPack } from "@/lib/dummy-ballots";
import type { Candidate, Panel, Post } from "@/lib/types";

type SheetsModule = typeof import("@/components/admin/dummy-ballot-sheets");

export function DummyBallotStudio({
  electionId,
  electionName,
  posts,
  panels,
}: {
  electionId: string;
  electionName: string;
  posts: Array<Post & { candidates: Candidate[] }>;
  panels: Panel[];
}) {
  const [packs, setPacks] = useState<DummyPostPack[] | null>(null);
  const [sheets, setSheets] = useState<SheetsModule | null>(null);
  const seed = useMemo(
    () =>
      dummyBallotSeed({
        electionId,
        invalidRate: 0.08,
        posts: posts.map((post) => ({
          id: post.id,
          votes_polled: post.votes_polled,
          seats: post.seats,
          candidateIds: post.candidates.map((candidate) => candidate.id),
        })),
      }),
    [electionId, posts],
  );

  useEffect(() => {
    try {
      setPacks(generateDummyBallots({ electionId, posts }));
    } catch {
      setPacks([]);
    }
  }, [electionId, posts, seed]);

  useEffect(() => {
    let cancelled = false;
    void import("@/components/admin/dummy-ballot-sheets").then((mod) => {
      if (!cancelled) setSheets(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (packs == null || sheets == null) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Preparing dummy ballots…
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Dummy ballots</h1>
        <p className="text-muted-foreground">
          Add candidates and set votes polled (or use Set random votes polled) before printing dummy papers.
        </p>
        <Button asChild variant="outline">
          <Link href="/admin">Back to Posts &amp; candidates</Link>
        </Button>
      </div>
    );
  }

  const { DummyBallotKey, DummyBallotSheets } = sheets;

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dummy ballots</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Print these marked papers for a counting drill. Each filled circle is a vote. Give counting staff
            the papers only, not the expected totals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin">Back</Link>
          </Button>
          <PrintDummyBallotsButton />
        </div>
      </div>
      <DummyBallotKey packs={packs} />
      <DummyBallotSheets electionName={electionName} packs={packs} panels={panels} />
    </div>
  );
}
