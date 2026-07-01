import type { Document } from "@/lib/db/types";

export const documentKeys = {
  all: ["documents"] as const,
  list: (chatId: string) => [...documentKeys.all, chatId] as const,
};

/** Accepted document types (client-side gate; server re-validates). */
export const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** File extensions used for the picker's `accept` attribute. */
export const ACCEPTED_DOCUMENT_EXTENSIONS = ".pdf,.txt,.md,.markdown,.docx";

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB

export function isAcceptedDocument(file: File): boolean {
  if ((ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    return true;
  }
  // Some browsers report an empty/quirky MIME type for .md/.txt — fall back to
  // the extension so those still upload.
  return /\.(txt|md|markdown)$/i.test(file.name);
}

export async function fetchDocuments(chatId: string): Promise<Document[]> {
  const res = await fetch(`/api/documents?chatId=${encodeURIComponent(chatId)}`);
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

export async function uploadDocument(
  chatId: string,
  file: File,
): Promise<Document> {
  const form = new FormData();
  form.append("chatId", chatId);
  form.append("file", file);

  const res = await fetch("/api/documents", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? `Upload failed (${res.status})`,
    );
  }
  // A "failed" status still returns 201 with the row + an error message.
  const doc = body as Document & { error?: string };
  if (doc.status === "failed") {
    throw new Error(doc.error ?? "Could not process this document.");
  }
  return doc;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete document");
}
