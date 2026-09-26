"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PrintReportButton } from "@/components/supervisor/print-report-button";
import { ResultReportDocument } from "@/components/supervisor/result-report-document";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveResultReportDetails } from "@/lib/actions/report";
import { applyReportDetails, type ResultReport, type ResultReportDetails } from "@/lib/result-report";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import Link from "next/link";

export function ResultReportComposer({
  backHref,
  electionId,
  report,
  initialDetails,
}: {
  backHref: string;
  electionId: string;
  report: ResultReport;
  initialDetails: ResultReportDetails;
}) {
  const { isSubmitting, run } = useAntiDuplicate();
  const [details, setDetails] = useState(initialDetails);
  const preview = useMemo(() => applyReportDetails(report, details), [report, details]);

  function setField<K extends keyof ResultReportDetails>(key: K, value: ResultReportDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function save() {
    void run(async () => {
      const result = await saveResultReportDetails(electionId, details);
      if (result.error) toast.error(result.error);
      else toast.success("Report details saved.");
    });
  }

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Result declaration</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Fill the office details, then print or save as PDF. Candidate results update from the count.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={backHref}>Back</Link>
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={save}>
            Save details
          </Button>
          <PrintReportButton />
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Letter details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="report_file_no">File number (No.)</Label>
            <Input
              id="report_file_no"
              value={details.fileNo}
              onChange={(event) => setField("fileNo", event.target.value)}
              placeholder="GECU/79/2026-B2(14)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report_dated">Dated</Label>
            <Input
              id="report_dated"
              type="date"
              value={details.dated}
              onChange={(event) => setField("dated", event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="report_ref_no">University circular number (Ref)</Label>
            <Input
              id="report_ref_no"
              value={details.refNo}
              onChange={(event) => setField("refNo", event.target.value)}
              placeholder="KTU/ASST1/(STUDENT AFFAIRS)/2943/2025"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report_ref_dated">University circular date</Label>
            <Input
              id="report_ref_dated"
              type="date"
              value={details.refDated}
              onChange={(event) => setField("refDated", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report_ceremony_date">Swearing-in date</Label>
            <Input
              id="report_ceremony_date"
              type="date"
              value={details.ceremonyDate}
              onChange={(event) => setField("ceremonyDate", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report_ceremony_time">Swearing-in time</Label>
            <Input
              id="report_ceremony_time"
              value={details.ceremonyTime}
              onChange={(event) => setField("ceremonyTime", event.target.value)}
              placeholder="afternoon or 10:00 AM"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="report_ceremony_venue">Swearing-in venue</Label>
            <Input
              id="report_ceremony_venue"
              value={details.ceremonyVenue}
              onChange={(event) => setField("ceremonyVenue", event.target.value)}
              placeholder="the Open Air Auditorium of the College"
            />
          </div>
        </CardContent>
      </Card>

      <ResultReportDocument report={preview} />
    </div>
  );
}
