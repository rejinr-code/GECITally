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
  return "/login";
}

export function parsePositiveInt(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function liveDisplaySettings(election: {
  results_rotate_seconds?: number | null;
  results_require_verification?: boolean | null;
} | null | undefined) {
  const rotate = election?.results_rotate_seconds;
  return {
    results_rotate_seconds:
      typeof rotate === "number" && rotate >= 5 && rotate <= 120 ? rotate : 12,
    results_require_verification: election?.results_require_verification !== false,
  };
}
