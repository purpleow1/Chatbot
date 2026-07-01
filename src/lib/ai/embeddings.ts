import "server-only";

import { embed, embedMany } from "ai";
import { embeddingModel, EMBEDDING_DIMENSIONS } from "./model";

/** Target characters per chunk and overlap between consecutive chunks. */
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

/** Hard cap on chunks per document to bound cost/latency for large files. */
const MAX_CHUNKS = 300;

/**
 * Splits raw text into overlapping, roughly sentence/paragraph-aligned chunks.
 * Overlap preserves context that would otherwise be cut across a boundary.
 */
export function chunkText(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    // Prefer to break on a paragraph/sentence/whitespace boundary near the end
    // of the window so we don't slice words in half.
    if (end < text.length) {
      const window = text.slice(start, end);
      const boundary = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("\n"),
      );
      if (boundary > CHUNK_SIZE * 0.5) {
        end = start + boundary + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

const googleEmbeddingOptions = (taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") => ({
  google: {
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType,
  },
});

/** Embed document chunks for storage (RETRIEVAL_DOCUMENT task type). */
export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return [];
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
    providerOptions: googleEmbeddingOptions("RETRIEVAL_DOCUMENT"),
  });
  return embeddings;
}

/** Embed a user query for similarity search (RETRIEVAL_QUERY task type). */
export async function embedQuery(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: googleEmbeddingOptions("RETRIEVAL_QUERY"),
  });
  return embedding;
}
