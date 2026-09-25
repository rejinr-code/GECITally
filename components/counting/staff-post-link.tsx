"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

function OpeningHint() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 text-sm font-medium text-emerald-800">
      Opening…
    </span>
  );
}

export function StaffPostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="relative block">
      {children}
      <OpeningHint />
    </Link>
  );
}
