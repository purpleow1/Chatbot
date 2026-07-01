import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/get-user";
import { adminClient } from "@/lib/supabase/admin";
import { getChatById } from "@/lib/db/chats";
import {
  createDocument,
  getDocumentsByChatId,
  insertDocumentChunks,
  updateDocumentStatus,
} from "@/lib/db/documents";
import {
  extractDocumentText,
  isSupportedDocumentType,
} from "@/lib/documents/extract";
import { chunkText, embedChunks } from "@/lib/ai/embeddings";

// Ingestion (extract + embed) can take longer than a chat turn.
export const maxDuration = 60;

const DOCUMENTS_BUCKET = "documents";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function extForMime(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "text/plain":
      return "txt";
    case "text/markdown":
      return "md";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    default:
      return "bin";
  }
}

// ---------------------------------------------------------------------------
// GET /api/documents?chatId=  — list a chat's documents
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const chatId = new URL(request.url).searchParams.get("chatId");
  if (!chatId) {
    return Response.json({ error: "chatId is required" }, { status: 400 });
  }

  try {
    const chat = await getChatById(chatId, user.id);
    if (!chat) return Response.json({ error: "Not found" }, { status: 404 });

    const documents = await getDocumentsByChatId(chatId, user.id);
    return Response.json(documents);
  } catch {
    return Response.json({ error: "Failed to list documents" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents  — upload a document to a chat and ingest it for RAG
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const chatId = formData.get("chatId");

  if (typeof chatId !== "string" || !chatId) {
    return Response.json({ error: "chatId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file field" }, { status: 400 });
  }
  if (!isSupportedDocumentType(file.type)) {
    return Response.json(
      { error: "Unsupported file type. Allowed: PDF, TXT, Markdown, DOCX." },
      { status: 415 },
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 413 },
    );
  }

  // Scope the target chat to the caller before storing anything.
  const chat = await getChatById(chatId, user.id);
  if (!chat) return Response.json({ error: "Not found" }, { status: 404 });

  const buffer = await file.arrayBuffer();
  const storagePath = `${user.id}/${chatId}/${randomUUID()}.${extForMime(file.type)}`;

  const { error: uploadError } = await adminClient.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[api/documents] storage upload failed:", uploadError);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }

  // Record the document up-front as "processing" so the UI can show status.
  const document = await createDocument({
    chatId,
    userId: user.id,
    filename: file.name || "document",
    storagePath,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  // Extract → chunk → embed → persist chunks. On any failure, mark the
  // document "failed" (keeping the row so the user sees the error state).
  try {
    const text = await extractDocumentText(buffer, file.type, document.filename);
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No text chunks produced");

    const embeddings = await embedChunks(chunks);
    await insertDocumentChunks(
      chunks.map((content, i) => ({
        documentId: document.id,
        chatId,
        userId: user.id,
        chunkIndex: i,
        content,
        embedding: embeddings[i],
      })),
    );

    await updateDocumentStatus(document.id, "ready");
    return Response.json({ ...document, status: "ready" }, { status: 201 });
  } catch (error) {
    console.error("[api/documents] ingestion failed:", error);
    await updateDocumentStatus(document.id, "failed").catch(() => {});
    const message =
      error instanceof Error ? error.message : "Failed to process document";
    return Response.json(
      { ...document, status: "failed", error: message },
      { status: 201 },
    );
  }
}
