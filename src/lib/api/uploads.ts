export type UploadResult = {
  storagePath: string;
  signedUrl: string;
  mediaType: string;
  sizeBytes: number;
  filename?: string;
};

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/uploads", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Upload failed (${res.status})`,
    );
  }
  return res.json() as Promise<UploadResult>;
}
