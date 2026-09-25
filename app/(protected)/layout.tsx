import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/layout/protected-shell";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  return (
    <ProtectedShell role={profile.role as UserRole} name={profile.full_name}>
      {children}
    </ProtectedShell>
  );
}
