import { requireAuth } from "@/lib/auth/get-user";
import { adminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

// Keep uploads responsive on Vercel serverless (images rarely exceed 10 s).
export const maxDuration = 30;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function extForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export async function POST(request: Request) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file field" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return Response.json(
      { error: "Unsupported file type. Allowed: jpeg, png, gif, webp." },
      { status: 415 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return Response.json(
      { error: "File too large. Maximum size is 5 MB." },
      { status: 413 },
    );
  }

  const ext = extForMime(file.type);
  const storagePath = `${user.id}/${randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await adminClient.storage
    .from("attachments")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[api/uploads] storage upload failed:", uploadError);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }

  // Signed URL valid for 1 hour — enough for immediate use in the send flow.
  const { data: signed, error: signError } = await adminClient.storage
    .from("attachments")
    .createSignedUrl(storagePath, 3600);

  if (signError || !signed) {
    console.error("[api/uploads] failed to create signed URL:", signError);
    return Response.json({ error: "Could not generate signed URL" }, { status: 500 });
  }

  return Response.json({
    storagePath,
    signedUrl: signed.signedUrl,
    mediaType: file.type,
    sizeBytes: file.size,
    filename: file.name || undefined,
  });
}
