import { ResultsBoard } from "@/components/results/results-board";
import { requireResultsAccess } from "@/lib/auth/require-role";
import { roleHome } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const { role } = await requireResultsAccess();
  return (
    <ResultsBoard
      homeHref={role === "display" ? "/" : roleHome(role)}
      signOutHref={role === "display" ? "/results/login" : "/login"}
    />
  );
}
