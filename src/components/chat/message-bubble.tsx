"use client"

import type { UIMessage } from "ai"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"
import { CopyButton } from "./copy-button"

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("")
}

type FilePart = { type: "file"; url: string; mediaType: string; filename?: string }
type DocumentPart = {
  type: "data-document"
  data: { filename: string; mediaType: string; sizeBytes: number }
}

function isImageFilePart(part: UIMessage["parts"][number]): part is FilePart {
  return (
    part.type === "file" &&
    typeof (part as FilePart).mediaType === "string" &&
    (part as FilePart).mediaType.startsWith("image/")
  )
}

function isDocumentPart(part: UIMessage["parts"][number]): part is DocumentPart {
  return part.type === "data-document"
}

function DocumentChips({ parts }: { parts: DocumentPart[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {parts.map((part, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-lg border bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80"
        >
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="max-w-[12rem] truncate">{part.data.filename}</span>
        </div>
      ))}
    </div>
  )
}

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user"
  const text = messageText(message)
  const imageParts = message.parts.filter(isImageFilePart)
  const documentParts = message.parts.filter(isDocumentPart)

  if (isUser) {
    return (
      <div className="group/msg flex w-full animate-in fade-in slide-in-from-bottom-1 justify-end duration-300">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          {documentParts.length > 0 && <DocumentChips parts={documentParts} />}
          <div className="overflow-hidden rounded-2xl bg-primary text-sm text-primary-foreground">
            {imageParts.length > 0 && (
              <div className={cn("flex flex-wrap gap-1", text ? "p-1 pb-0" : "p-1")}>
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
              <p className="px-4 py-2.5 break-words whitespace-pre-wrap">{text}</p>
            )}
          </div>
          {text && (
            <div className="opacity-0 transition-opacity group-hover/msg:opacity-100">
              <CopyButton value={text} label="Copy message" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Assistant message — no bubble, full-width markdown like ChatGPT.
  return (
    <div className="group/msg flex w-full animate-in fade-in slide-in-from-bottom-1 justify-start duration-300">
      <div className="flex w-full max-w-full flex-col gap-1">
        {imageParts.length > 0 && (
          <div className="flex flex-wrap gap-1">
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
        {text && <Markdown content={text} />}
        {text && (
          <div className="opacity-0 transition-opacity group-hover/msg:opacity-100">
            <CopyButton value={text} label="Copy message" />
          </div>
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
