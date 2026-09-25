import Link from "next/link";
import { BrandLockup } from "@/components/branding/geci-mark";
import { SiteFooter } from "@/components/layout/site-footer";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#d1fae5,_#f8fafc_50%)]">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <BrandLockup />
            <CardTitle className="pt-4">Counting Supervisor login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm next={next} />
            <p className="text-center text-sm text-muted-foreground">
              Hall display?{" "}
              <Link href="/results/login" className="text-primary hover:underline">
                Public results login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
