import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { SiteFooter } from "@/components/layout/site-footer";
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
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader role={profile.role as UserRole} name={profile.full_name} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
      <SiteFooter />
    </div>
  );
}
