"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SignOutButton() {
  const router = useRouter();
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
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // Still leave the signed-in UI.
          }
          router.replace("/login");
          router.refresh();
        })();
      }}
    >
      {pending ? <Spinner /> : null}
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
