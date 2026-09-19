import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { roleHome } from "@/lib/utils";

export async function requireRole(allowed: UserRole | UserRole[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as UserRole | undefined;
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  if (!role || !allowedRoles.includes(role)) {
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
  if (path === "/results" || path.startsWith("/results/")) return "/results";
  if (role === "admin" && (path === "/admin" || path.startsWith("/admin/"))) return next;
  if (role === "staff" && (path === "/staff" || path.startsWith("/staff/"))) return next;
  if (role === "supervisor" && (path === "/supervisor" || path.startsWith("/supervisor/"))) return next;
  return home;
}
