import "server-only";

import { adminClient } from "@/lib/supabase/admin";
import type { Document, DocumentStatus, MatchedChunk } from "./types";

export async function createDocument(fields: {
  chatId: string;
  userId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<Document> {
  const { data, error } = await adminClient
    .from("documents")
    .insert({
      chat_id: fields.chatId,
      user_id: fields.userId,
      filename: fields.filename,
      storage_path: fields.storagePath,
      mime_type: fields.mimeType,
      size_bytes: fields.sizeBytes,
      status: "processing",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Document;
}

/** List a chat's documents (newest first), scoped to the owner. */
export async function getDocumentsByChatId(
  chatId: string,
  userId: string,
): Promise<Document[]> {
  const { data, error } = await adminClient
    .from("documents")
    .select("*")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Document[];
}

export async function getDocumentById(
  id: string,
  userId: string,
): Promise<Document | null> {
  const { data, error } = await adminClient
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Document;
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
): Promise<void> {
  const { error } = await adminClient
    .from("documents")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

/** Delete a document and return its storage path (chunks cascade). */
export async function deleteDocument(
  id: string,
  userId: string,
): Promise<string> {
  const { data, error } = await adminClient
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("storage_path")
    .single();

  if (error) throw error;
  return (data as { storage_path: string }).storage_path;
}

/** Bulk-insert the embedded chunks for a document. */
export async function insertDocumentChunks(
  rows: {
    documentId: string;
    chatId: string;
    userId: string;
    chunkIndex: number;
    content: string;
    embedding: number[];
  }[],
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await adminClient.from("document_chunks").insert(
    rows.map((r) => ({
      document_id: r.documentId,
      chat_id: r.chatId,
      user_id: r.userId,
      chunk_index: r.chunkIndex,
      content: r.content,
      embedding: r.embedding,
    })),
  );

  if (error) throw error;
}

/** Whether a chat has at least one fully-ingested document. */
export async function chatHasReadyDocuments(chatId: string): Promise<boolean> {
  const { count, error } = await adminClient
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("status", "ready");

  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Top-k similarity search over a chat's chunks via the pgvector RPC. */
export async function matchDocumentChunks(
  chatId: string,
  queryEmbedding: number[],
  matchCount: number,
): Promise<MatchedChunk[]> {
  const { data, error } = await adminClient.rpc("match_document_chunks", {
    p_chat_id: chatId,
    // pgvector accepts a JSON number array; PostgREST casts it to vector(768).
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });

  if (error) throw error;
  return (data ?? []) as MatchedChunk[];
}
