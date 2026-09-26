import { getAuthProfile } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/layout/protected-shell";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await getAuthProfile();

  if (!user || !profile) redirect("/login");

  return (
    <ProtectedShell role={profile.role as UserRole} name={profile.full_name}>
      {children}
    </ProtectedShell>
  );
}
