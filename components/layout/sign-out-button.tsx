"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function clearBrowserAuthCookies() {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const name = cookie.split("=")[0]?.trim();
    if (!name.startsWith("sb-")) continue;
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

export function SignOutButton({ href = "/login" }: { href?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      disabled={pending}
      onClick={() => {
        if (pending) return;
        setPending(true);
        void (async () => {
          try {
            const supabase = createClient();
            await Promise.race([
              supabase.auth.signOut({ scope: "local" }),
              new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
            ]);
          } catch {
            // Leave even if the auth call is slow or fails.
          }
          clearBrowserAuthCookies();
          window.location.assign(href);
        })();
      }}
    >
      {pending ? <Spinner /> : null}
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
