import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { requireAuth } from "@/lib/auth/get-user";
import { chatModel, SYSTEM_PROMPT, generateChatTitle } from "@/lib/ai/model";
import { getChatById, touchChat, updateChat } from "@/lib/db/chats";
import { createMessage } from "@/lib/db/messages";

// Allow streamed responses up to 30s (Vercel serverless default cap).
export const maxDuration = 30;

type TextPart = { type: "text"; text: string };

/** Extract persistable text parts from an AI SDK UIMessage. */
function toTextParts(message: UIMessage): TextPart[] {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => ({ type: "text", text: (p as { text: string }).text }));
}

function plainText(message: UIMessage): string {
  return toTextParts(message)
    .map((p) => p.text)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  let body: { chatId?: string; messages?: UIMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { chatId, messages } = body;
  if (!chatId || !Array.isArray(messages)) {
    return Response.json(
      { error: "chatId and messages are required" },
      { status: 400 },
    );
  }

  // Scope the chat to the caller before doing anything else.
  const chat = await getChatById(chatId, user.id);
  if (!chat) return Response.json({ error: "Not found" }, { status: 404 });

  // Persist the newest user message up-front so it survives even if the
  // client disconnects mid-stream.
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const firstUserText = lastUserMessage ? plainText(lastUserMessage) : "";

  if (lastUserMessage) {
    const parts = toTextParts(lastUserMessage);
    if (parts.length > 0) {
      await createMessage({ chatId, role: "user", parts });
    }
  }

  const stream = streamText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return stream.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage, isAborted }) => {
      try {
        const parts = toTextParts(responseMessage);
        if (parts.length > 0) {
          await createMessage({ chatId, role: "assistant", parts });
        }

        // Bump updated_at so the chat floats to the top of the sidebar.
        await touchChat(chatId);

        // Auto-title on the first exchange (skip if the user stopped early).
        if (!chat.title && !isAborted && firstUserText) {
          const title = await generateChatTitle(firstUserText);
          await updateChat(chatId, user.id, { title });
        }
      } catch (error) {
        console.error("[api/chat] failed to persist assistant message:", error);
      }
    },
  });
}
