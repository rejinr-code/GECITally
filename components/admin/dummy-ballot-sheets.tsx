"use client";

import { dummyCandidateLine } from "@/lib/dummy-ballots";
import type { DummyPostPack } from "@/lib/dummy-ballots";
import type { Candidate, Panel } from "@/lib/types";
import { panelTheme } from "@/lib/results-studio";
import { cn, initials } from "@/lib/utils";

function VoteStamp({ label }: { label?: string }) {
  return (
    <span className="relative inline-flex size-8 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-[3px] border-black bg-black/90" />
      {label ? <span className="relative text-[11px] font-bold text-white">{label}</span> : null}
    </span>
  );
}

function EmptyMark() {
  return <span className="inline-block size-8 rounded-full border-2 border-neutral-400" />;
}

function CandidatePhoto({ candidate }: { candidate: Candidate }) {
  if (candidate.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={candidate.photo_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
      {initials(candidate.name)}
    </span>
  );
}

function BallotPaper({
  pack,
  ballot,
  electionName,
  panels,
}: {
  pack: DummyPostPack;
  ballot: DummyPostPack["ballots"][number];
  electionName: string;
  panels: Panel[];
}) {
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));

  return (
    <article className="relative break-inside-avoid rounded-sm border-2 border-black bg-white p-3 text-black">
      <p className="absolute right-2 top-2 text-[10px] font-bold uppercase tracking-widest text-red-700">Dummy</p>
      <header className="border-b border-black pb-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest">Government Engineering College Idukki</p>
        <p className="text-[11px]">{electionName}</p>
        <h2 className="mt-1 text-sm font-bold">{pack.post.name}</h2>
        <p className="text-[11px]">
          Ballot {ballot.serial} of {pack.ballots.length}
          {pack.post.seats > 1 ? ` · mark ${pack.post.seats} names` : ""}
        </p>
      </header>
      <ul className="mt-2 space-y-1.5">
        {pack.candidates.map((candidate) => {
          const slot = ballot.marks.findIndex(
            (mark) => mark.kind === "candidate" && mark.candidateId === candidate.id,
          );
          const marked = slot >= 0;
          const theme = panelTheme(candidate.panel_name, panelById.get(candidate.panel_id ?? "")?.color);
          return (
            <li
              key={candidate.id}
              className={cn(
                "flex items-center gap-2 rounded border px-2 py-1.5 text-[12px]",
                marked ? "border-black bg-neutral-100" : "border-neutral-300",
              )}
            >
              {marked ? <VoteStamp label={pack.post.seats > 1 ? String(slot + 1) : undefined} /> : <EmptyMark />}
              <CandidatePhoto candidate={candidate} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{candidate.name}</p>
                <p className="truncate text-[10px] text-neutral-600">{dummyCandidateLine(candidate) || "Independent"}</p>
              </div>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                style={{ background: theme.bg, color: theme.fg }}
              >
                {candidate.panel_name ?? "IND"}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function DummyBallotSheets({
  electionName,
  packs,
  panels,
}: {
  electionName: string;
  packs: DummyPostPack[];
  panels: Panel[];
}) {
  return (
    <div className="space-y-10">
      {packs.map((pack) => (
        <section key={pack.post.id} className="space-y-4">
          <h2 className="print:hidden text-xl font-semibold">
            {pack.post.name} · {pack.ballots.length} dummy ballots
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            {pack.ballots.map((ballot) => (
              <BallotPaper
                key={`${pack.post.id}-${ballot.serial}`}
                pack={pack}
                ballot={ballot}
                electionName={electionName}
                panels={panels}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function DummyBallotKey({ packs }: { packs: DummyPostPack[] }) {
  return (
    <section className="print:hidden rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Expected totals (admin only)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Do not give this sheet to counting staff. Use it to check the desk after the drill.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {packs.map((pack) => (
          <div key={pack.post.id} className="rounded-lg border p-3 text-sm">
            <p className="font-semibold">{pack.post.name}</p>
            <ul className="mt-2 space-y-1">
              {pack.expected.map((row) => (
                <li key={row.candidateId} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="tabular-nums">{row.votes}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t pt-1 text-muted-foreground">
                <span>Fully invalid ballots</span>
                <span className="tabular-nums">{pack.invalidBallots}</span>
              </li>
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
