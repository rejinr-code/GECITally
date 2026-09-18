"use server";

import { revalidatePath } from "next/cache";
import { createClient as createPasswordClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ElectionState, UserRole } from "@/lib/types";
import { deleteCandidatePhoto, uploadCandidatePhoto } from "@/lib/storage/candidate-photos";
import { isDepartmentCode, YEARS } from "@/lib/candidate-class";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Admin access required");
  return { supabase, user };
}

async function confirmAdminPassword(password: string) {
  const { supabase, user } = await requireAdmin();
  if (!user.email) return { error: "This admin account has no email to verify." };
    const passwordValue = typeof password === "string" ? password.trim() : "";
    if (!passwordValue) return { error: "Enter your admin password to confirm." };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return { error: "Supabase is not configured." };

    const check = createPasswordClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await check.auth.signInWithPassword({
      email: user.email,
      password: passwordValue,
    });
    if (error) return { error: "Incorrect password." };
    return { supabase };
}

export async function upsertElection(formData: FormData) {
  try {
    const { supabase } = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      date: String(formData.get("date") ?? ""),
      total_votes_polled: Number(formData.get("total_votes_polled") ?? 0),
      count_limit: Number(formData.get("count_limit") ?? 1),
    };

    if (!payload.name || !payload.date) {
      return { error: "Election name and date are required." };
    }
    if (payload.count_limit < 1) {
      return { error: "Count finalisation limit must be at least 1." };
    }
    if (payload.total_votes_polled < 0) {
      return { error: "Total votes polled cannot be negative." };
    }

    if (id) {
      const { error } = await supabase.from("elections").update(payload).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("elections").insert(payload);
      if (error) return { error: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save election." };
  }
}

export async function setElectionState(electionId: string, state: ElectionState, password: string) {
  try {
    if (!["setup", "counting", "finalised"].includes(state)) {
      return { error: "Invalid election state." };
    }
    if (typeof password !== "string" || !password.trim()) {
      return { error: "Enter your admin password to confirm." };
    }
    const confirmed = await confirmAdminPassword(password);
    if ("error" in confirmed) return { error: confirmed.error };

    const { error } = await confirmed.supabase.from("elections").update({ state }).eq("id", electionId);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    revalidatePath("/staff");
    revalidatePath("/supervisor");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update state." };
  }
}

export async function savePost(formData: FormData) {
  try {
    const { supabase } = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const payload = {
      election_id: String(formData.get("election_id") ?? ""),
      name: String(formData.get("name") ?? "").trim(),
      seats: Number(formData.get("seats") ?? 1),
      votes_polled: Number(formData.get("votes_polled") ?? 0),
      display_order: Number(formData.get("display_order") ?? 0),
    };
    if (!payload.name) return { error: "Post name is required." };
    if (payload.seats < 1) return { error: "Seats must be at least 1." };
    const votesRaw = String(formData.get("votes_polled") ?? "").trim();
    if (votesRaw === "") return { error: "Votes polled is required for each post." };
    if (!Number.isInteger(payload.votes_polled) || payload.votes_polled < 0) {
      return { error: "Votes polled must be a whole number of 0 or more." };
    }

    if (id) {
      const { error } = await supabase.from("posts").update(payload).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("posts").insert(payload);
      if (error) return { error: error.message };
    }
    revalidatePath("/admin");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save post." };
  }
}

export async function deletePost(postId: string) {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete post." };
  }
}

export async function saveCandidate(formData: FormData) {
  try {
    const { supabase } = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const panelId = String(formData.get("panel_id") ?? "").trim();
    let panel_id: string | null = null;
    let panel_name: string | null = null;

    if (panelId) {
      const { data: panel, error: panelError } = await supabase
        .from("panels")
        .select("id, name")
        .eq("id", panelId)
        .maybeSingle();
      if (panelError) return { error: panelError.message };
      if (!panel) return { error: "Select a configured panel, or Independent." };
      panel_id = panel.id;
      panel_name = panel.name;
    }

    const branch = String(formData.get("branch") ?? "").trim().toUpperCase();
    const year = Number(formData.get("year") ?? "");
    if (!isDepartmentCode(branch)) return { error: "Select a branch." };
    if (!YEARS.includes(year as (typeof YEARS)[number])) {
      return { error: "Select a year." };
    }

    const payload = {
      post_id: String(formData.get("post_id") ?? ""),
      name: String(formData.get("name") ?? "").trim(),
      panel_id,
      panel_name,
      branch,
      year,
      display_order: Number(formData.get("display_order") ?? 0),
    };
    if (!payload.name) return { error: "Candidate name is required." };
    if (!payload.post_id) return { error: "Post is required." };

    let photo_url: string | null = null;
    if (id) {
      const { data: existing } = await supabase
        .from("candidates")
        .select("photo_url")
        .eq("id", id)
        .maybeSingle();
      photo_url = existing?.photo_url ?? null;
      if (formData.get("remove_photo") === "1") {
        await deleteCandidatePhoto(photo_url);
        photo_url = null;
      }
    }

    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const uploaded = await uploadCandidatePhoto(photo, payload.post_id);
      if (uploaded.error) return { error: uploaded.error };
      if (uploaded.url) {
        await deleteCandidatePhoto(photo_url);
        photo_url = uploaded.url;
      }
    }

    const row = { ...payload, photo_url };

    if (id) {
      const { error } = await supabase.from("candidates").update(row).eq("id", id);
      if (error) {
        if (error.message.includes("branch") || error.code === "PGRST204") {
          return {
            error: "Run supabase/migrations/0004_candidate_year.sql in the Supabase SQL editor.",
          };
        }
        return { error: error.message };
      }
    } else {
      const { error } = await supabase.from("candidates").insert(row);
      if (error) {
        if (error.message.includes("branch") || error.code === "PGRST204") {
          return {
            error: "Run supabase/migrations/0004_candidate_year.sql in the Supabase SQL editor.",
          };
        }
        return { error: error.message };
      }
    }
    revalidatePath("/admin");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save candidate." };
  }
}

export async function deleteCandidate(candidateId: string) {
  try {
    const { supabase } = await requireAdmin();
    const { data: existing } = await supabase
      .from("candidates")
      .select("photo_url")
      .eq("id", candidateId)
      .maybeSingle();
    const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
    if (error) return { error: error.message };
    await deleteCandidatePhoto(existing?.photo_url);
    revalidatePath("/admin");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete candidate." };
  }
}

export async function savePanel(formData: FormData) {
  try {
    const { supabase } = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const payload = {
      election_id: String(formData.get("election_id") ?? ""),
      name: String(formData.get("name") ?? "").trim(),
      display_order: Number(formData.get("display_order") ?? 0),
    };
    if (!payload.election_id) return { error: "Save election metadata first." };
    if (!payload.name) return { error: "Panel name is required." };

    if (id) {
      const { error } = await supabase.from("panels").update(payload).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("panels").insert(payload);
      if (error) {
        if (error.message.includes("panels_election_id_name_key") || error.code === "23505") {
          return { error: "A panel with that name already exists." };
        }
        return { error: error.message };
      }
    }
    revalidatePath("/admin");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save panel." };
  }
}

export async function deletePanel(panelId: string) {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("panels").delete().eq("id", panelId);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete panel." };
  }
}

export async function createStaffAccount(formData: FormData) {
  try {
    await requireAdmin();
    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "staff") as UserRole;
    const postIds = formData.getAll("post_ids").map(String).filter(Boolean);

    if (!fullName || !email || !password) {
      return { error: "Name, email, and password are required." };
    }
    if (password.length < 8) {
      return { error: "Password must be at least 8 characters." };
    }
    if (!["admin", "staff", "supervisor"].includes(role)) {
      return { error: "Invalid role." };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error || !data.user) {
      return { error: error?.message ?? "Could not create user." };
    }

    await admin.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      role,
    });

    if (role === "staff" && postIds.length) {
      const { error: assignError } = await admin.from("staff_assignments").insert(
        postIds.map((post_id) => ({ staff_id: data.user!.id, post_id })),
      );
      if (assignError) return { error: assignError.message };
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create account." };
  }
}

export async function updateStaffAssignments(staffId: string, postIds: string[]) {
  try {
    const { supabase } = await requireAdmin();
    const { error: deleteError } = await supabase
      .from("staff_assignments")
      .delete()
      .eq("staff_id", staffId);
    if (deleteError) return { error: deleteError.message };

    if (postIds.length) {
      const { error } = await supabase.from("staff_assignments").insert(
        postIds.map((post_id) => ({ staff_id: staffId, post_id })),
      );
      if (error) return { error: error.message };
    }
    revalidatePath("/admin");
    revalidatePath("/staff");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update assignments." };
  }
}

export async function updateProfileRole(profileId: string, role: UserRole) {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update role." };
  }
}

export async function resetElectionCounts(electionId: string) {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc("reset_election_counts", {
      p_election_id: electionId,
    });
    if (error) return { error: error.message };
    revalidatePath("/admin");
    revalidatePath("/staff");
    revalidatePath("/supervisor");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not reset counts." };
  }
}
