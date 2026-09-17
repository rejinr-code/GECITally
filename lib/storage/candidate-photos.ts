import { createAdminClient } from "@/lib/supabase/admin";

export const CANDIDATE_PHOTO_BUCKET = "candidate-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function photoPathFromPublicUrl(url: string | null | undefined) {
  if (!url) return null;
  const marker = `/object/public/${CANDIDATE_PHOTO_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function ensurePhotoBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(CANDIDATE_PHOTO_BUCKET);
  if (data) return admin;

  const { error } = await admin.storage.createBucket(CANDIDATE_PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(error.message);
  }
  return admin;
}

export async function uploadCandidatePhoto(file: File, postId: string) {
  if (file.size <= 0) return { url: null as string | null };
  if (file.size > MAX_BYTES) return { error: "Photo must be 5 MB or smaller." };
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Use a JPG, PNG, WebP, or GIF photo." };
  }

  const admin = await ensurePhotoBucket();
  const path = `${postId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const { error } = await admin.storage.from(CANDIDATE_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { error: error.message };

  const { data } = admin.storage.from(CANDIDATE_PHOTO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function deleteCandidatePhoto(publicUrl: string | null | undefined) {
  const path = photoPathFromPublicUrl(publicUrl);
  if (!path) return;
  const admin = createAdminClient();
  await admin.storage.from(CANDIDATE_PHOTO_BUCKET).remove([path]);
}
