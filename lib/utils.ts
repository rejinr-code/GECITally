import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function postSerial(post: { display_order?: number | null }, index: number) {
  return post.display_order && post.display_order > 0 ? post.display_order : index + 1;
}

export function shortPostName(name: string) {
  return name
    .replace(/^UG Representative - /, "UG · ")
    .replace("Editor of the College Magazine", "Magazine Editor")
    .replace("University Union Councillors", "Union Councillors")
    .replace("Women Representatives", "Women Reps")
    .replace("Vice-Chairperson", "Vice-Chair")
    .replace("General Secretary", "Gen. Secretary")
    .replace("Arts Club Secretary", "Arts Secretary")
    .replace("Computer Science & Engineering", "CSE")
    .replace("Electrical & Electronics Engineering", "EEE")
    .replace("Electronics & Communication Engineering", "ECE")
    .replace("Information Technology", "IT")
    .replace("Robotics & AI", "RAI")
    .replace("Mechanical Engineering", "ME");
}

export function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function roleHome(role: string | null | undefined) {
  if (role === "admin") return "/admin";
  if (role === "supervisor") return "/supervisor";
  if (role === "staff") return "/staff";
  if (role === "display") return "/results";
  return "/login";
}

export function canViewResults(role: string | null | undefined) {
  return role === "admin" || role === "staff" || role === "supervisor" || role === "display";
}

export function roleLabel(role: string | null | undefined) {
  if (role === "staff") return "Counting Supervisor";
  if (role === "supervisor") return "Returning Officer";
  if (role === "display") return "Public results";
  if (role === "admin") return "Admin";
  return role ?? "";
}

export function parsePositiveInt(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function resolveSeats<T>(
  ranked: T[],
  seats: number,
  getVotes: (item: T) => number,
): { elected: T[]; tied: T[] } {
  const elected: T[] = [];
  const tied: T[] = [];
  let remaining = Math.max(0, seats);
  let index = 0;
  while (index < ranked.length && remaining > 0) {
    const votes = getVotes(ranked[index]);
    if (votes <= 0) break;
    let end = index + 1;
    while (end < ranked.length && getVotes(ranked[end]) === votes) end += 1;
    const group = ranked.slice(index, end);
    if (group.length <= remaining) {
      elected.push(...group);
      remaining -= group.length;
    } else {
      tied.push(...group);
      remaining = 0;
    }
    index = end;
  }
  return { elected, tied };
}

export function competitionRank<T>(ranked: T[], index: number, getVotes: (item: T) => number) {
  const votes = getVotes(ranked[index]);
  return ranked.findIndex((item) => getVotes(item) === votes) + 1;
}

export function ballotMarkCount(seats: number | null | undefined) {
  return Math.max(1, seats ?? 1);
}

export function ordinalMark(slot: number) {
  const n = slot + 1;
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function invalidSlotKey(slot: number) {
  return `__invalid_${slot}__`;
}

export function marksToBallots(marks: number, seats: number | null | undefined) {
  const per = ballotMarkCount(seats);
  if (per <= 1) return marks;
  return Math.floor(marks / per);
}

export function liveCountedBallots(post: {
  total_verified_votes: number;
  invalid_votes?: number | null;
  seats?: number | null;
}) {
  return marksToBallots(
    (post.total_verified_votes ?? 0) + (post.invalid_votes ?? 0),
    post.seats,
  );
}

export function postIsDeclared(post: { is_finalised?: boolean | null }) {
  return Boolean(post.is_finalised);
}

export function hallHasFirstCount(
  posts: Array<{
    total_verified_votes?: number | null;
    invalid_votes?: number | null;
    seats?: number | null;
    candidates?: Array<{ votes?: number | null }>;
  }>,
) {
  return posts.some(
    (post) =>
      liveCountedBallots({
        total_verified_votes: post.total_verified_votes ?? 0,
        invalid_votes: post.invalid_votes,
        seats: post.seats,
      }) > 0 || (post.candidates ?? []).some((candidate) => (candidate.votes ?? 0) > 0),
  );
}

export function hallVotesPolled(
  election: { total_votes_polled?: number | null } | null | undefined,
  posts: Array<{ votes_polled?: number | null }>,
) {
  const overall = election?.total_votes_polled ?? 0;
  if (overall > 0) return overall;
  return posts.reduce((max, post) => Math.max(max, post.votes_polled ?? 0), 0);
}

export type PublicHallStage = "standby" | "poll" | "counting" | "live" | "final";

export function publicHallStage(
  election: { state?: string | null; poll_announced?: boolean | null } | null | undefined,
  posts: Array<{
    total_verified_votes?: number | null;
    invalid_votes?: number | null;
    seats?: number | null;
    candidates?: Array<{ votes?: number | null }>;
  }>,
): PublicHallStage {
  if (!election) return "standby";
  if (election.state === "finalised") return "final";
  if (election.state === "counting") return hallHasFirstCount(posts) ? "live" : "counting";
  if (election.poll_announced) return "poll";
  return "standby";
}

export function countedBallotsFromRounds(
  rounds: Array<{ id: string; status: string; invalid_votes?: number | null }>,
  entries: Array<{ round_id: string; votes: number }>,
  seats: number | null | undefined,
) {
  return rounds
    .filter((round) => round.status === "verified" || round.status === "pending_verification")
    .reduce((sum, round) => {
      const candidateVotes = entries
        .filter((entry) => entry.round_id === round.id)
        .reduce((inner, entry) => inner + entry.votes, 0);
      return sum + marksToBallots(candidateVotes + (round.invalid_votes ?? 0), seats);
    }, 0);
}

export function rankByVotesThenName<T>(items: T[], getVotes: (item: T) => number, getName: (item: T) => string) {
  return [...items].sort((a, b) => {
    const voteDiff = getVotes(b) - getVotes(a);
    if (voteDiff !== 0) return voteDiff;
    return getName(a).localeCompare(getName(b), "en");
  });
}

export function liveDisplaySettings(election: {
  results_rotate_seconds?: number | null;
  results_require_verification?: boolean | null;
  counting_require_verification?: boolean | null;
} | null | undefined) {
  const rotate = election?.results_rotate_seconds;
  const resultsRequireVerification = election?.results_require_verification !== false;
  const countingRequireVerification = election?.counting_require_verification !== false;
  return {
    results_rotate_seconds:
      typeof rotate === "number" && rotate >= 5 && rotate <= 120 ? rotate : 12,
    results_require_verification: resultsRequireVerification,
    counting_require_verification: countingRequireVerification,
    counting_requires_supervisor: countingRequireVerification && resultsRequireVerification,
  };
}
