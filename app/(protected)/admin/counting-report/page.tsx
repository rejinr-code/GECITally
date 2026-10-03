import { requireRole } from "@/lib/auth/require-role";
import { CountingReportScreen } from "@/components/admin/counting-report-screen";

export const dynamic = "force-dynamic";

export default async function AdminCountingReportPage() {
  await requireRole("admin");
  return <CountingReportScreen />;
}
