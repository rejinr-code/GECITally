"use client";

import Link from "next/link";
import { CountingReportDocument } from "@/components/admin/counting-report-document";
import { PrintReportButton } from "@/components/supervisor/print-report-button";
import { Button } from "@/components/ui/button";
import type { CountingReport } from "@/lib/counting-report";

export function CountingReportView({ report }: { report: CountingReport }) {
  return (
    <div className="space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Counting report</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Print or save as PDF. Each Counting Supervisor signs the rounds they counted. The Returning Officer
            countersigns the same sheet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin">Back</Link>
          </Button>
          <PrintReportButton title="" />
        </div>
      </div>
      <CountingReportDocument report={report} />
    </div>
  );
}
