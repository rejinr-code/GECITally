import { reportClassLabel } from "@/lib/candidate-class";
import type { Candidate, CountEntry, CountRound, Election, Post } from "@/lib/types";
import { countedBallotsFromRounds, formatNumber, rankByVotesThenName, resolveSeats } from "@/lib/utils";

export type ResultReportRow = {
  serial: number;
  postName: string;
  candidateName: string;
  classLabel: string;
  margin: string;
  status: "elected" | "tie";
};

export type ResultReport = {
  electionName: string;
  electionDate: string;
  academicYear: string;
  issuedOn: string;
  fileNo: string;
  refNo: string;
  refDated: string;
  ceremonyDate: string;
  ceremonyWeekday: string;
  ceremonyTime: string;
  ceremonyVenue: string;
  rows: ResultReportRow[];
  complete: boolean;
  pendingPosts: string[];
};

export type ResultReportDetails = {
  fileNo: string;
  dated: string;
  refNo: string;
  refDated: string;
  ceremonyDate: string;
  ceremonyTime: string;
  ceremonyVenue: string;
};

export function isoDateInput(value?: string | Date | null) {
  if (!value) return "";
  const { year, month, day } = civilParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function slashDate(value?: string | Date | null) {
  if (!value) return "";
  const { year, month, day } = civilParts(value);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function weekdayName(value?: string | Date | null) {
  if (!value) return "";
  const { year, month, day } = civilParts(value);
  return WEEKDAYS_EN[new Date(year, month - 1, day).getDay()];
}

export function todayIsoDate() {
  const { year, month, day } = civilParts(new Date());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function datedDeclaration(value?: string | Date | null) {
  return ordinalDay(value);
}

export type TextRun = { text: string; bold?: boolean };

export function ceremonySentence(details: Pick<ResultReport, "ceremonyDate" | "ceremonyWeekday" | "ceremonyTime" | "ceremonyVenue">): TextRun[] {
  if (!details.ceremonyDate) {
    return [{ text: "The swearing in ceremony of the elected candidates will be held as notified by the college." }];
  }
  const time = details.ceremonyTime.trim();
  const session = /^(morning|afternoon|evening)$/i.test(time);
  const parts: TextRun[] = [{ text: "The swearing in ceremony of the elected candidates will be held " }];
  if (session) {
    parts.push({ text: "in the " }, { text: time.toLowerCase(), bold: true }, { text: " of " }, { text: details.ceremonyDate, bold: true });
  } else if (time) {
    parts.push({ text: "at " }, { text: time, bold: true }, { text: " on " }, { text: details.ceremonyDate, bold: true });
  } else {
    parts.push({ text: "on " }, { text: details.ceremonyDate, bold: true });
  }
  if (details.ceremonyWeekday) parts.push({ text: ", " }, { text: details.ceremonyWeekday, bold: true });
  if (details.ceremonyVenue.trim()) parts.push({ text: " at " }, { text: details.ceremonyVenue.trim(), bold: true });
  parts.push({ text: "." });
  return parts;
}

export function detailsFromElection(election: Election): ResultReportDetails {
  return {
    fileNo: election.report_file_no?.trim() ?? "",
    dated: isoDateInput(election.report_dated) || todayIsoDate(),
    refNo: election.report_ref_no?.trim() ?? "",
    refDated: isoDateInput(election.report_ref_dated),
    ceremonyDate: isoDateInput(election.report_ceremony_date),
    ceremonyTime: election.report_ceremony_time?.trim() || "afternoon",
    ceremonyVenue: election.report_ceremony_venue?.trim() || "the Open Air Auditorium of the College",
  };
}

export function applyReportDetails(report: ResultReport, details: ResultReportDetails): ResultReport {
  return {
    ...report,
    fileNo: details.fileNo.trim(),
    issuedOn: details.dated ? datedDeclaration(details.dated) : datedDeclaration(new Date()),
    refNo: details.refNo.trim(),
    refDated: details.refDated ? slashDate(details.refDated) : "",
    ceremonyDate: details.ceremonyDate ? datedDeclaration(details.ceremonyDate) : "",
    ceremonyWeekday: details.ceremonyDate ? weekdayName(details.ceremonyDate) : "",
    ceremonyTime: details.ceremonyTime.trim(),
    ceremonyVenue: details.ceremonyVenue.trim(),
  };
}

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function civilParts(value?: string | Date | null) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return { year, month, day };
  }
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    value instanceof Date ? value : new Date(),
  );
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function parseCivilDate(value?: string | Date | null) {
  const { year, month, day } = civilParts(value);
  return new Date(year, month - 1, day);
}

function ordinalDay(value?: string | Date | null) {
  const { year, month, day } = civilParts(value);
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix} ${MONTHS_EN[month - 1]} ${year}`;
}

export function academicYearSpan(value?: string | Date | null) {
  const date = parseCivilDate(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

const OFFICE_POSTS: Record<string, string> = {
  chairperson: "The Chairperson",
  "the chairperson": "The Chairperson",
  "vice-chairperson": "The Vice-Chairperson",
  "vice chairperson": "The Vice-Chairperson",
  "the vice-chairperson": "The Vice-Chairperson",
  "the vice chairperson": "The Vice-Chairperson",
  "general secretary": "The General Secretary",
  "the general secretary": "The General Secretary",
  "editor of the college magazine": "The Editor of the College Magazine",
  "the editor of the college magazine": "The Editor of the College Magazine",
  "arts club secretary": "The Arts Club Secretary",
  "the arts club secretary": "The Arts Club Secretary",
};

export function officialPostName(name: string) {
  const raw = name.trim().replace(/\s+/g, " ");
  const mapped = OFFICE_POSTS[raw.toLowerCase()];
  if (mapped) return mapped;
  const ug = raw.match(/^ug representative\s*[-–—:]?\s*(?:b\.?\s*tech\s*[-–—:]?\s*)?(.*)$/i);
  if (ug) {
    const dept = (ug[1] ?? "").trim();
    return dept ? `UG REPRESENTATIVE - B.Tech\n${dept}` : "UG REPRESENTATIVE - B.Tech";
  }
  return raw;
}

function marginLabel(
  electedVotes: number,
  runnerVotes: number | undefined,
  contested: boolean,
) {
  if (!contested || runnerVotes == null || runnerVotes <= 0) return "Unanimous";
  const gap = electedVotes - runnerVotes;
  if (gap <= 0) return "Tie";
  return `${formatNumber(gap)} vote${gap === 1 ? "" : "s"}`;
}

export function countingComplete(
  posts: Post[],
  rounds: Array<{ id: string; post_id: string; status: string; invalid_votes?: number | null }>,
  entries: Array<{ round_id: string; votes: number }>,
) {
  const verified = rounds.filter((round) => round.status === "verified");
  const pendingPosts: string[] = [];
  for (const post of posts) {
    const polled = post.votes_polled ?? 0;
    if (polled <= 0) continue;
    const counted = countedBallotsFromRounds(
      verified.filter((round) => round.post_id === post.id),
      entries,
      post.seats,
    );
    if (counted < polled) pendingPosts.push(post.name);
  }
  return { complete: pendingPosts.length === 0 && posts.some((post) => (post.votes_polled ?? 0) > 0), pendingPosts };
}

export function buildResultReport({
  election,
  posts,
  candidates,
  rounds,
  entries,
}: {
  election: Election;
  posts: Post[];
  candidates: Candidate[];
  rounds: CountRound[] | Array<{ id: string; post_id: string; status: string; invalid_votes?: number | null }>;
  entries: CountEntry[] | Array<{ round_id: string; candidate_id: string; votes: number }>;
}): ResultReport {
  const progress = countingComplete(posts, rounds, entries);
  const complete = election.state === "finalised" || progress.complete;
  const pendingPosts = complete ? [] : progress.pendingPosts;
  const verifiedRounds = rounds.filter((round) => round.status === "verified");
  const rows: ResultReportRow[] = [];
  let serial = 1;

  for (const post of [...posts].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name, "en"))) {
    const postCandidates = candidates.filter((candidate) => candidate.post_id === post.id);
    const postRoundIds = new Set(verifiedRounds.filter((round) => round.post_id === post.id).map((round) => round.id));
    const tallied = postCandidates.map((candidate) => ({
      candidate,
      votes: entries
        .filter((entry) => postRoundIds.has(entry.round_id) && entry.candidate_id === candidate.id)
        .reduce((sum, entry) => sum + entry.votes, 0),
    }));
    const ranked = rankByVotesThenName(tallied, (row) => row.votes, (row) => row.candidate.name);
    const { elected, tied } = resolveSeats(ranked, post.seats, (row) => row.votes);
    const winnerIds = new Set([...elected, ...tied].map((row) => row.candidate.id));
    const runner = ranked.find((row) => !winnerIds.has(row.candidate.id));
    const contested = ranked.filter((row) => row.votes > 0).length > 1;
    const unopposed = elected.length === 0 && tied.length === 0 && postCandidates.length > 0 && postCandidates.length <= post.seats;

    const declared = unopposed
      ? postCandidates.map((candidate) => ({ candidate, votes: 0 }))
      : elected;

    if (declared.length === 0 && tied.length === 0) continue;
    const postSerial = serial++;
    for (const row of declared) {
      rows.push({
        serial: postSerial,
        postName: officialPostName(post.name),
        candidateName: row.candidate.name,
        classLabel: reportClassLabel(row.candidate.branch, row.candidate.year, row.candidate.semester, election.date),
        margin: unopposed ? "Unanimous" : marginLabel(row.votes, runner?.votes, contested),
        status: "elected",
      });
    }
    for (const row of tied) {
      rows.push({
        serial: postSerial,
        postName: officialPostName(post.name),
        candidateName: row.candidate.name,
        classLabel: reportClassLabel(row.candidate.branch, row.candidate.year, row.candidate.semester, election.date),
        margin: "Tie",
        status: "tie",
      });
    }
  }

  return {
    electionName: election.name,
    electionDate: datedDeclaration(election.date),
    academicYear: academicYearSpan(election.date),
    issuedOn: datedDeclaration(election.report_dated || new Date()),
    fileNo: election.report_file_no?.trim() ?? "",
    refNo: election.report_ref_no?.trim() ?? "",
    refDated: election.report_ref_dated ? slashDate(election.report_ref_dated) : "",
    ceremonyDate: election.report_ceremony_date ? datedDeclaration(election.report_ceremony_date) : "",
    ceremonyWeekday: election.report_ceremony_date ? weekdayName(election.report_ceremony_date) : "",
    ceremonyTime: election.report_ceremony_time?.trim() || "",
    ceremonyVenue: election.report_ceremony_venue?.trim() || "",
    rows,
    complete,
    pendingPosts,
  };
}
