import type { UserRole } from "@/lib/types";

export type NavItem = { href: string; label: string };

export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/dummy-ballots", label: "Dummy ballots" },
    { href: "/admin/counting-report", label: "Counting report" },
    { href: "/admin/report", label: "Result report" },
    { href: "/results", label: "Live results" },
  ],
  staff: [
    { href: "/staff", label: "Counting Supervisor" },
    { href: "/results", label: "Live results" },
  ],
  supervisor: [
    { href: "/supervisor", label: "Returning Officer" },
    { href: "/supervisor/report", label: "Result report" },
    { href: "/results", label: "Live results" },
  ],
  display: [{ href: "/results", label: "Live results" }],
};
