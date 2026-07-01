import { requireAuth } from "@/lib/auth/get-user";
import { adminClient } from "@/lib/supabase/admin";
import { deleteDocument, getDocumentById } from "@/lib/db/documents";
import type { NextRequest } from "next/server";

type Params = Promise<{ documentId: string }>;

const DOCUMENTS_BUCKET = "documents";

// ---------------------------------------------------------------------------
// DELETE /api/documents/[documentId] — remove a document, its chunks, and blob
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params },
) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const { documentId } = await params;

  try {
    const existing = await getDocumentById(documentId, user.id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    // Delete the row first (chunks cascade), then best-effort remove the blob.
    const storagePath = await deleteDocument(documentId, user.id);
    const { error: storageError } = await adminClient.storage
      .from(DOCUMENTS_BUCKET)
      .remove([storagePath]);
    if (storageError) {
      console.error("[api/documents] storage cleanup failed:", storageError);
    }

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
