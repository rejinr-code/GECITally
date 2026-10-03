import { getAuthProfile } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/layout/protected-shell";
import { ROLE_NAV } from "@/lib/nav";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await getAuthProfile();

  if (!user || !profile) redirect("/login");

  const role = profile.role as UserRole;

  return (
    <ProtectedShell role={role} name={profile.full_name} nav={ROLE_NAV[role] ?? []}>
      {children}
    </ProtectedShell>
  );
}
