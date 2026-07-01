import "server-only";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  // Surface a clear error early instead of a cryptic provider failure mid-stream.
  console.warn(
    "[ai] Missing GOOGLE_GENERATIVE_AI_API_KEY — /api/chat will fail until it is set.",
  );
}

/**
 * Gemini model used for chat + (later) vision.
 *
 * Options are listed from most capable (top) to lightest (low). Each model has
 * its own free-tier daily request budget, so switching is an easy way to work
 * around a per-model quota (HTTP 429). Uncomment exactly one.
 */
// export const CHAT_MODEL_ID = "gemini-2.5-flash";
// export const CHAT_MODEL_ID = "gemini-2.5-flash-lite";
export const CHAT_MODEL_ID = "gemini-3.1-flash-lite";

export const chatModel = google(CHAT_MODEL_ID);

/**
 * Embedding model for document RAG. `gemini-embedding-001` is generated at
 * 768 dimensions to match the `vector(768)` column + HNSW index in the schema.
 * Shares the same free-tier-friendly Gemini API key as the chat model.
 */
export const EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

export const embeddingModel = google.textEmbeddingModel(EMBEDDING_MODEL_ID);

export const SYSTEM_PROMPT =
  "You are a helpful, friendly AI assistant. Answer clearly and concisely. " +
  "Use Markdown for formatting, and fenced code blocks with a language tag for code.";

/**
 * Generates a short, human-readable chat title from the first user message.
 * Falls back to a truncated version of the message if the model call fails,
 * so titling never blocks or breaks message persistence.
 */
export async function generateChatTitle(firstUserText: string): Promise<string> {
  const trimmed = firstUserText.trim();
  const fallback =
    trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed || "New chat";

  try {
    const { text } = await generateText({
      model: chatModel,
      system:
        "You generate concise chat titles. Reply with a 3-6 word title only — " +
        "no quotes, no punctuation at the end, no prefixes.",
      prompt: `Message:\n${trimmed.slice(0, 500)}`,
    });
    const title = text.replace(/["\n]/g, "").trim();
    return title ? title.slice(0, 80) : fallback;
  } catch (error) {
    console.error("[ai] title generation failed:", error);
    return fallback;
  }
}
