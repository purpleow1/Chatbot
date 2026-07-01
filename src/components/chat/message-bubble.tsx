"use client"

import type { UIMessage } from "ai"
import { cn } from "@/lib/utils"

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("")
}

type FilePart = { type: "file"; url: string; mediaType: string; filename?: string }

function isImageFilePart(part: UIMessage["parts"][number]): part is FilePart {
  return (
    part.type === "file" &&
    typeof (part as FilePart).mediaType === "string" &&
    (part as FilePart).mediaType.startsWith("image/")
  )
}

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user"
  const text = messageText(message)
  const imageParts = message.parts.filter(isImageFilePart)

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          imageParts.length > 0 || text ? "overflow-hidden" : "",
        )}
      >
        {imageParts.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1",
              text ? "p-1 pb-0" : "p-1",
            )}
          >
            {imageParts.map((part, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={part.url}
                alt={part.filename ?? "Attached image"}
                className="max-h-64 max-w-full rounded-xl object-contain"
              />
            ))}
          </div>
        )}

        {text && (
          <p className="px-4 py-2.5 whitespace-pre-wrap break-words">{text}</p>
        )}
      </div>
    </div>
  )
}

/** Three-dot bouncing indicator shown while awaiting the first token. */
export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
    </div>
  )
}
