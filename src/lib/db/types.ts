// ---------------------------------------------------------------------------
// Database row types — mirror the Postgres schema exactly.
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant" | "system";

/**
 * A single part of a message, matching AI SDK v7 UIMessage parts.
 * Stored as jsonb in the messages.parts column.
 *
 * For "file" parts, `url` holds the Supabase Storage path (not a signed URL).
 * The messages API route generates fresh signed URLs before returning them.
 */
export type MessagePart =
  | { type: "text"; text: string }
  | { type: "file"; url: string; mediaType: string; filename?: string }
  // UI-only chip for a document attached to a chat as RAG context. Rendered in
  // the message thread but never sent to the model (the model gets retrieved
  // chunks via the system prompt instead).
  | { type: "data-document"; data: DocumentPartData }
  | { type: "tool-invocation"; toolInvocationId: string; toolName: string; args: unknown; result?: unknown; state: string }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown };

export interface DocumentPartData {
  filename: string;
  mediaType: string;
  sizeBytes: number;
}

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  parts: MessagePart[];
  created_at: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  chat_id: string;
  user_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface Usage {
  user_id: string;
  anon_message_count: number;
  updated_at: string;
}

export type DocumentStatus = "processing" | "ready" | "failed";

export interface Document {
  id: string;
  chat_id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chat_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  created_at: string;
}

/** A chunk returned from the similarity-search RPC (with source + score). */
export interface MatchedChunk {
  content: string;
  document_id: string;
  filename: string;
  chunk_index: number;
  similarity: number;
}
