import "server-only";

import { embedQuery } from "./embeddings";
import { chatHasReadyDocuments, matchDocumentChunks } from "@/lib/db/documents";

/** How many chunks to retrieve, and the char budget for injected context. */
const TOP_K = 6;
const MAX_CONTEXT_CHARS = 6000;

/**
 * Builds a grounding-context block from a chat's uploaded documents for the
 * given user query, or returns null when the chat has no ready documents or
 * nothing relevant is found — so chats without documents behave unchanged.
 *
 * Failures are swallowed (logged) and treated as "no context" so a retrieval
 * hiccup never blocks the chat response.
 */
export async function buildDocumentContext(
  chatId: string,
  queryText: string,
): Promise<string | null> {
  const query = queryText.trim();
  if (!query) return null;

  try {
    if (!(await chatHasReadyDocuments(chatId))) return null;

    const embedding = await embedQuery(query);
    const matches = await matchDocumentChunks(chatId, embedding, TOP_K);
    if (matches.length === 0) return null;

    const blocks: string[] = [];
    let total = 0;
    for (const m of matches) {
      const block = `[Source: ${m.filename}]\n${m.content}`;
      if (total + block.length > MAX_CONTEXT_CHARS) break;
      blocks.push(block);
      total += block.length;
    }
    if (blocks.length === 0) return null;

    return (
      "Use the following context from the user's uploaded documents to answer " +
      "their question. If the answer isn't in the context, say so and answer " +
      "from general knowledge.\n\n" +
      "----- DOCUMENT CONTEXT -----\n" +
      blocks.join("\n\n---\n\n") +
      "\n----- END CONTEXT -----"
    );
  } catch (error) {
    console.error("[retrieval] failed to build document context:", error);
    return null;
  }
}
