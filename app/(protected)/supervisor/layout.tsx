import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/require-role";

export default async function SupervisorLayout({ children }: { children: ReactNode }) {
  await requireRole("supervisor");
  return children;
}
