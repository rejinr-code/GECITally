import { requireRole } from "@/lib/auth/require-role";
import { ResultReportScreen } from "@/components/supervisor/result-report-screen";

export default async function AdminResultReportPage() {
  await requireRole("admin");
  return <ResultReportScreen backHref="/admin" />;
}
