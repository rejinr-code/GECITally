"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { SiteFooter } from "@/components/layout/site-footer";
import type { NavItem } from "@/lib/nav";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProtectedShell({
  role,
  name,
  nav,
  children,
}: {
  role: UserRole;
  name: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const countingDesk = pathname.startsWith("/staff/") && pathname !== "/staff";
  const printPage =
    pathname.endsWith("/report") ||
    pathname.endsWith("/counting-report") ||
    pathname.startsWith("/admin/dummy-ballots");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="print:hidden">
        <AppHeader role={role} name={name} nav={nav} />
      </div>
      <div
        className={cn(
          "mx-auto w-full flex-1 px-4",
          printPage ? "max-w-[230mm] py-6 print:max-w-none print:px-0 print:py-0" : "max-w-6xl",
          !printPage && (countingDesk ? "py-4" : "py-8"),
        )}
      >
        {children}
      </div>
      {countingDesk || printPage ? null : (
        <div className="print:hidden">
          <SiteFooter />
        </div>
      )}
    </div>
  );
}
