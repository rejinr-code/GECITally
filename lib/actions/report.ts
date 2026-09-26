"use server";

import { revalidatePath } from "next/cache";
import { getAuthProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ResultReportDetails } from "@/lib/result-report";

function blankToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function saveResultReportDetails(electionId: string, details: ResultReportDetails) {
  try {
    const { user, profile } = await getAuthProfile();
    if (!user) return { error: "Not authenticated." };
    if (profile?.role !== "admin" && profile?.role !== "supervisor") {
      return { error: "Only Admin or the Returning Officer can save report details." };
    }
    if (!electionId) return { error: "No election selected." };

    const admin = createAdminClient();
    const { error } = await admin
      .from("elections")
      .update({
        report_file_no: blankToNull(details.fileNo),
        report_dated: blankToNull(details.dated),
        report_ref_no: blankToNull(details.refNo),
        report_ref_dated: blankToNull(details.refDated),
        report_ceremony_date: blankToNull(details.ceremonyDate),
        report_ceremony_time: blankToNull(details.ceremonyTime),
        report_ceremony_venue: blankToNull(details.ceremonyVenue),
      })
      .eq("id", electionId);

    if (error) {
      if (/report_file_no|column/i.test(error.message)) {
        return {
          error: "Run supabase/migrations/0018_result_report_details.sql in the Supabase SQL editor, then save again.",
        };
      }
      return { error: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/report");
    revalidatePath("/supervisor");
    revalidatePath("/supervisor/report");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save report details." };
  }
}
