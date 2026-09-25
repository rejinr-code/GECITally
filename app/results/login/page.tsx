import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/branding/geci-mark";
import { SiteFooter } from "@/components/layout/site-footer";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import Link from "next/link";

export default async function ResultsLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    redirect(roleHome(profile?.role as UserRole | undefined));
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#d1fae5,_#f8fafc_50%)]">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <BrandLockup />
            <CardTitle className="pt-4">Public results login</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sign in with a hall display account to open the live results board.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm next="/results" />
            <p className="text-center text-sm text-muted-foreground">
              Counting Supervisor?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Counting Supervisor login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
