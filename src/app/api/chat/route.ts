import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { requireAuth } from "@/lib/auth/get-user";
import { chatModel, SYSTEM_PROMPT, generateChatTitle } from "@/lib/ai/model";
import { getChatById, touchChat, updateChat } from "@/lib/db/chats";
import { createMessage } from "@/lib/db/messages";
import { createAttachment } from "@/lib/db/attachments";
import { getAnonMessageCount, incrementAnonCount } from "@/lib/db/usages";
import { ANON_MESSAGE_LIMIT } from "@/lib/constants";
import type { MessagePart } from "@/lib/db/types";

// Allow streamed responses up to 30s (Vercel serverless default cap).
export const maxDuration = 30;

type TextPart = { type: "text"; text: string };
type AttachmentInput = {
  storagePath: string;
  mediaType: string;
  sizeBytes: number;
  filename?: string;
};

/** Extract text parts from an AI SDK UIMessage. */
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

  let body: {
    chatId?: string;
    messages?: UIMessage[];
    attachments?: AttachmentInput[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { chatId, messages, attachments = [] } = body;
  if (!chatId || !Array.isArray(messages)) {
    return Response.json(
      { error: "chatId and messages are required" },
      { status: 400 },
    );
  }

  // Scope the chat to the caller before doing anything else.
  const chat = await getChatById(chatId, user.id);
  if (!chat) return Response.json({ error: "Not found" }, { status: 404 });

  // Enforce the free-question limit for anonymous users. Signed-up users
  // are never rate-limited by this counter.
  const isAnonymous = user.is_anonymous === true;
  if (isAnonymous) {
    const count = await getAnonMessageCount(user.id);
    if (count >= ANON_MESSAGE_LIMIT) {
      return Response.json(
        {
          error: "message_limit_reached",
          limit: ANON_MESSAGE_LIMIT,
          remaining: 0,
        },
        { status: 403 },
      );
    }
  }

  // Locate the most recent user message to persist + title.
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const firstUserText = lastUserMessage ? plainText(lastUserMessage) : "";

  // Persist the user message up-front so it survives a mid-stream disconnect.
  let savedUserMessageId: string | null = null;
  if (lastUserMessage) {
    const textParts = toTextParts(lastUserMessage);

    // Build file parts: replace the signed URL with the durable storagePath
    // so the stored part can be re-signed on load instead of expiring.
    const rawFileParts = lastUserMessage.parts.filter(
      (p) => p.type === "file",
    ) as Array<{ type: "file"; url: string; mediaType: string; filename?: string }>;
    const fileParts: MessagePart[] = rawFileParts.map((p, i) => ({
      type: "file",
      url: attachments[i]?.storagePath ?? p.url,
      mediaType: attachments[i]?.mediaType ?? p.mediaType,
      filename: attachments[i]?.filename ?? p.filename,
    }));

    const allParts: MessagePart[] = [...textParts, ...fileParts];
    if (allParts.length > 0) {
      const saved = await createMessage({ chatId, role: "user", parts: allParts });
      savedUserMessageId = saved.id;
    }
  }

  // Count this question against the anonymous allowance.
  if (isAnonymous) {
    try {
      await incrementAnonCount(user.id);
    } catch (error) {
      console.error("[api/chat] failed to increment anon usage:", error);
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
        // Persist the assistant reply (text parts only; no attachments on assistant side).
        const textParts = toTextParts(responseMessage);
        if (textParts.length > 0) {
          await createMessage({ chatId, role: "assistant", parts: textParts });
        }

        // Persist attachment rows now that we have the message id.
        if (savedUserMessageId && attachments.length > 0) {
          await Promise.all(
            attachments.map((att) =>
              createAttachment({
                messageId: savedUserMessageId!,
                chatId,
                userId: user.id,
                storagePath: att.storagePath,
                mimeType: att.mediaType,
                sizeBytes: att.sizeBytes,
              }),
            ),
          );
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
