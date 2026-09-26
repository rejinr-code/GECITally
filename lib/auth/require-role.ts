import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient, getAuthProfile } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { canViewResults, roleHome } from "@/lib/utils";

export const requireRole = cache(async (allowed: UserRole | UserRole[]) => {
  const supabase = await createClient();
  const { user, profile } = await getAuthProfile();

  if (!user) redirect("/login");

  const role = profile?.role as UserRole | undefined;
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  if (!role || !allowedRoles.includes(role)) {
    redirect(roleHome(role));
  }

  return { supabase, user, role };
});

export async function requireResultsAccess() {
  const supabase = await createClient();
  const { user, profile } = await getAuthProfile();

  if (!user) redirect("/results/login");

  const role = profile?.role as UserRole | undefined;
  if (!canViewResults(role)) {
    redirect(roleHome(role));
  }

  return { supabase, user, role };
}

export function safeNextPath(next: string, role: string | null | undefined) {
  const home = roleHome(role);
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return home;
  }
  if (next.includes("://") || next.includes("\\") || next.includes("@")) {
    return home;
  }

  const path = next.split("?")[0] ?? next;
  if (path === "/results/login" || path.startsWith("/results/login/")) {
    return home;
  }
  if (canViewResults(role) && (path === "/results" || path.startsWith("/results/"))) {
    return "/results";
  }
  if (role === "admin" && (path === "/admin" || path.startsWith("/admin/"))) return next;
  if (role === "staff" && (path === "/staff" || path.startsWith("/staff/"))) return next;
  if (role === "supervisor" && (path === "/supervisor" || path.startsWith("/supervisor/"))) return next;
  return home;
}
