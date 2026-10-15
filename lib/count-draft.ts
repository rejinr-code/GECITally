const PREFIX = "geci-tally-count-draft:";

export type CountDraft = {
  postId: string;
  roundNumber: number;
  votes: Record<string, number>;
  pendingAdds: Record<string, number>;
  candidateSlots: Record<string, number[]>;
  pendingCandidateSlots: Record<string, number[]>;
  draft: (string | null)[];
  lastId: string | null;
  lastSlot: number | null;
  savedAt: number;
};

function asIntMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const amount = Number(item);
    if (!Number.isInteger(amount) || amount < 0) return null;
    next[key] = amount;
  }
  return next;
}

function asSlotMap(value: unknown): Record<string, number[]> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next: Record<string, number[]> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!Array.isArray(item)) return null;
    const marks = item.map((entry) => Number(entry));
    if (marks.some((entry) => !Number.isInteger(entry) || entry < 0)) return null;
    next[key] = marks;
  }
  return next;
}

function asDraft(value: unknown): (string | null)[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => (typeof item === "string" ? item : null));
}

export function countDraftKey(postId: string) {
  return `${PREFIX}${postId}`;
}

export function countDraftHasBallots(draft: Pick<CountDraft, "votes" | "pendingAdds" | "draft">) {
  return (
    Object.values(draft.votes).some((value) => value > 0) ||
    Object.values(draft.pendingAdds).some((value) => value > 0) ||
    draft.draft.some(Boolean)
  );
}

export function loadCountDraft(postId: string, roundNumber: number): CountDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(countDraftKey(postId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CountDraft>;
    const votes = asIntMap(parsed.votes);
    const pendingAdds = asIntMap(parsed.pendingAdds);
    const candidateSlots = asSlotMap(parsed.candidateSlots);
    const pendingCandidateSlots = asSlotMap(parsed.pendingCandidateSlots);
    const draft = asDraft(parsed.draft);
    if (
      parsed.postId !== postId ||
      parsed.roundNumber !== roundNumber ||
      !votes ||
      !pendingAdds ||
      !candidateSlots ||
      !pendingCandidateSlots ||
      !draft
    ) {
      return null;
    }
    const restored: CountDraft = {
      postId,
      roundNumber,
      votes,
      pendingAdds,
      candidateSlots,
      pendingCandidateSlots,
      draft,
      lastId: typeof parsed.lastId === "string" ? parsed.lastId : null,
      lastSlot: Number.isInteger(parsed.lastSlot) ? Number(parsed.lastSlot) : null,
      savedAt: Number(parsed.savedAt) || Date.now(),
    };
    if (!countDraftHasBallots(restored)) return null;
    return restored;
  } catch {
    return null;
  }
}

export function saveCountDraft(draft: CountDraft) {
  if (typeof window === "undefined") return;
  try {
    if (!countDraftHasBallots(draft)) {
      const raw = window.localStorage.getItem(countDraftKey(draft.postId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CountDraft>;
      if (parsed.roundNumber === draft.roundNumber) {
        window.localStorage.removeItem(countDraftKey(draft.postId));
      }
      return;
    }
    window.localStorage.setItem(countDraftKey(draft.postId), JSON.stringify(draft));
  } catch {
    // Private mode or full disk should not block counting.
  }
}

export function clearCountDraft(postId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(countDraftKey(postId));
  } catch {
    // Ignore storage failures.
  }
}
