import { requireRole } from "@/lib/auth/require-role";
import { ResultReportScreen } from "@/components/supervisor/result-report-screen";

export default async function SupervisorResultReportPage() {
  await requireRole("supervisor");
  return <ResultReportScreen backHref="/supervisor" />;
}
