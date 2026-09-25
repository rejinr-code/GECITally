"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { SiteFooter } from "@/components/layout/site-footer";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProtectedShell({
  role,
  name,
  children,
}: {
  role: UserRole;
  name: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const countingDesk = pathname.startsWith("/staff/") && pathname !== "/staff";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader role={role} name={name} />
      <div className={cn("mx-auto w-full max-w-6xl flex-1 px-4", countingDesk ? "py-4" : "py-8")}>
        {children}
      </div>
      {countingDesk ? null : <SiteFooter />}
    </div>
  );
}
