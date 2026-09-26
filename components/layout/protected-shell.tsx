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
  const reportPage = pathname.endsWith("/report");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="print:hidden">
        <AppHeader role={role} name={name} />
      </div>
      <div
        className={cn(
          "mx-auto w-full flex-1 px-4",
          reportPage ? "max-w-[230mm] py-6 print:max-w-none print:px-0 print:py-0" : "max-w-6xl",
          !reportPage && (countingDesk ? "py-4" : "py-8"),
        )}
      >
        {children}
      </div>
      {countingDesk || reportPage ? null : (
        <div className="print:hidden">
          <SiteFooter />
        </div>
      )}
    </div>
  );
}
