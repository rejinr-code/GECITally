export const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "ECE", name: "Electronics & Communication Engineering" },
  { code: "EEE", name: "Electrical & Electronics Engineering" },
  { code: "IT", name: "Information Technology" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "RAI", name: "Robotics & AI" },
] as const;

export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"];

export const YEARS = [1, 2, 3, 4] as const;

const ORDINAL_SUFFIX: Record<Intl.LDMLPluralRule, string> = {
  zero: "th",
  one: "st",
  two: "nd",
  few: "rd",
  many: "th",
  other: "th",
};

export function yearLabel(year: number) {
  const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(year);
  return `${year}${ORDINAL_SUFFIX[rule]}`;
}

export function isDepartmentCode(value: string): value is DepartmentCode {
  return DEPARTMENTS.some((department) => department.code === value);
}

export function academicYear(year?: number | null, semester?: number | null) {
  if (year && year >= 1 && year <= 4) return year;
  if (semester && semester >= 1 && semester <= 8) return Math.ceil(semester / 2);
  return null;
}

export function candidateClassLabel(
  branch?: string | null,
  year?: number | null,
  semester?: number | null,
) {
  const code = branch?.trim().toUpperCase() ?? "";
  const resolvedYear = academicYear(year, semester);
  if (code && resolvedYear) return `${code} ${yearLabel(resolvedYear)} Year`;
  if (code) return code;
  if (resolvedYear) return `${yearLabel(resolvedYear)} Year`;
  return "";
}

export function reportClassLabel(
  branch?: string | null,
  year?: number | null,
  semester?: number | null,
  electionDate?: string | Date | null,
) {
  const code = branch?.trim().toUpperCase() ?? "";
  if (semester && semester >= 1 && semester <= 8) {
    return code ? `S${semester} ${code}` : `S${semester}`;
  }
  const resolvedYear = academicYear(year, semester);
  if (resolvedYear) {
    const month = electionDate
      ? (typeof electionDate === "string" ? new Date(electionDate) : electionDate).getMonth() + 1
      : 0;
    const oddTerm = month >= 7;
    const sem = oddTerm ? resolvedYear * 2 - 1 : resolvedYear * 2;
    return code ? `S${sem} ${code}` : `S${sem}`;
  }
  return code || "—";
}
