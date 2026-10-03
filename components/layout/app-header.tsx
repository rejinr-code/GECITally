"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/components/branding/geci-mark";
import { SignOutButton } from "@/components/layout/sign-out-button";
import type { NavItem } from "@/lib/nav";
import type { UserRole } from "@/lib/types";
import { cn, roleHome, roleLabel } from "@/lib/utils";

function isCurrent(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/admin" || href === "/supervisor") return false;
  return pathname.startsWith(`${href}/`);
}

export function AppHeader({
  role,
  name,
  nav,
}: {
  role: UserRole;
  name: string;
  nav: NavItem[];
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={roleHome(role)}>
          <BrandLockup compact />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={!(item.href.startsWith("/admin/") || item.href.endsWith("/report"))}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 transition",
                  current
                    ? "bg-emerald-800 font-medium text-white"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel(role)}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
