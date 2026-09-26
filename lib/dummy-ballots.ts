import { candidateClassLabel } from "@/lib/candidate-class";
import type { Candidate, Post } from "@/lib/types";
import { ballotMarkCount } from "@/lib/utils";

export type DummyMark =
  | { kind: "candidate"; candidateId: string }
  | { kind: "invalid" };

export type DummyBallot = {
  serial: number;
  marks: DummyMark[];
};

export type DummyPostPack = {
  post: Post;
  candidates: Candidate[];
  ballots: DummyBallot[];
  expected: Array<{ candidateId: string; name: string; votes: number }>;
  invalidBallots: number;
};

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickMark(
  rng: () => number,
  candidates: Candidate[],
  used: Set<string>,
  invalidRate: number,
): DummyMark {
  if (candidates.length === 0 || rng() < invalidRate) return { kind: "invalid" };
  const pool = candidates.filter((candidate) => !used.has(candidate.id));
  if (pool.length === 0) return { kind: "invalid" };
  const pick = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  used.add(pick.id);
  return { kind: "candidate", candidateId: pick.id };
}

export function dummyBallotSeed(input: {
  electionId: string;
  posts: Array<{ id: string; votes_polled: number; seats: number; candidateIds: string[] }>;
  invalidRate: number;
}) {
  const body = input.posts
    .map((post) => `${post.id}:${post.votes_polled}:${post.seats}:${post.candidateIds.join(",")}`)
    .join(";");
  return hashSeed(`${input.electionId}|${Math.round(input.invalidRate * 1000)}|${body}`);
}

export function generateDummyBallots({
  electionId,
  posts,
  invalidRate = 0.08,
}: {
  electionId: string;
  posts: Array<Post & { candidates: Candidate[] }>;
  invalidRate?: number;
}): DummyPostPack[] {
  const rate = Math.min(0.35, Math.max(0, invalidRate));
  const packs: DummyPostPack[] = [];

  for (const post of posts) {
    const candidates = [...post.candidates].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name, "en"),
    );
    const polled = post.votes_polled ?? 0;
    if (candidates.length === 0 || polled <= 0) continue;

    const rng = mulberry32(
      dummyBallotSeed({
        electionId,
        posts: [{ id: post.id, votes_polled: polled, seats: post.seats, candidateIds: candidates.map((candidate) => candidate.id) }],
        invalidRate: rate,
      }),
    );
    const seats = ballotMarkCount(post.seats);
    const expectedVotes = new Map(candidates.map((candidate) => [candidate.id, 0]));
    const ballots: DummyBallot[] = [];
    let invalidBallots = 0;

    for (let serial = 1; serial <= polled; serial += 1) {
      const used = new Set<string>();
      const marks = Array.from({ length: seats }, () => pickMark(rng, candidates, used, rate));
      if (marks.every((mark) => mark.kind === "invalid")) invalidBallots += 1;
      for (const mark of marks) {
        if (mark.kind === "candidate") expectedVotes.set(mark.candidateId, (expectedVotes.get(mark.candidateId) ?? 0) + 1);
      }
      ballots.push({ serial, marks });
    }

    packs.push({
      post,
      candidates,
      ballots,
      invalidBallots,
      expected: candidates.map((candidate) => ({
        candidateId: candidate.id,
        name: candidate.name,
        votes: expectedVotes.get(candidate.id) ?? 0,
      })),
    });
  }

  return packs;
}

export function dummyCandidateLine(candidate: Candidate) {
  const classLabel = candidateClassLabel(candidate.branch, candidate.year, candidate.semester);
  return [classLabel, candidate.panel_name].filter(Boolean).join(" · ");
}
