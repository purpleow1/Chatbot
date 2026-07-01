"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type FileUIPart } from "ai"
import { ArrowUp, Image as ImageIcon, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { chatKeys } from "@/lib/api/chats"
import { fetchMessages, messageKeys, toUIMessage } from "@/lib/api/messages"
import { fetchUsage, usageKeys } from "@/lib/api/usage"
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  uploadFile,
  type UploadResult,
} from "@/lib/api/uploads"
import { MessageBubble, TypingIndicator } from "./message-bubble"
import { useUpgrade } from "./upgrade"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingAttachment = {
  /** Stable key for React list rendering. */
  key: string
  /** Local object URL for instant thumbnail preview. */
  previewUrl: string
  /** Original file — held in memory until upload completes or is removed. */
  file: File
} & (
  | { status: "uploading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; result: UploadResult }
)

// ---------------------------------------------------------------------------
// ChatView (loading shell)
// ---------------------------------------------------------------------------

export function ChatView({ chatId }: { chatId: string }) {
  const {
    data: initialMessages,
    isPending,
    isError,
  } = useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => fetchMessages(chatId),
    staleTime: Infinity,
  })

  if (isPending) {
    return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-4">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-16 w-1/2" />
        <Skeleton className="h-24 w-3/4" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-destructive">
        Failed to load this conversation. Try refreshing the page.
      </div>
    )
  }

  return (
    <Conversation
      key={chatId}
      chatId={chatId}
      initialMessages={initialMessages.map(toUIMessage)}
    />
  )
}

// ---------------------------------------------------------------------------
// Conversation (live chat)
// ---------------------------------------------------------------------------

function Conversation({
  chatId,
  initialMessages,
}: {
  chatId: string
  initialMessages: ReturnType<typeof toUIMessage>[]
}) {
  const queryClient = useQueryClient()
  const { openUpgrade } = useUpgrade()
  const [input, setInput] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: usage } = useQuery({
    queryKey: usageKeys.detail(),
    queryFn: fetchUsage,
  })

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { chatId },
      }),
    [chatId],
  )

  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
      queryClient.invalidateQueries({ queryKey: usageKeys.all })
    },
    onError: (err) => {
      if (err.message.includes("message_limit_reached")) {
        queryClient.invalidateQueries({ queryKey: usageKeys.all })
        openUpgrade()
      }
    },
  })

  const atFreeLimit = usage?.isAnonymous === true && usage.remaining <= 0
  const isBusy = status === "submitted" || status === "streaming"
  const isUploading = pendingAttachments.some((a) => a.status === "uploading")
  const hasUploadErrors = pendingAttachments.some((a) => a.status === "error")
  const lastMessage = messages[messages.length - 1]
  const awaitingReply =
    status === "submitted" ||
    (status === "streaming" && lastMessage?.role === "user")

  // Auto-scroll when messages change.
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, awaitingReply])

  // Revoke object URLs on unmount to avoid memory leaks.
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((a) => URL.revokeObjectURL(a.previewUrl))
    }
    // intentionally only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------------------------------------------------------------------------
  // Upload helpers
  // -------------------------------------------------------------------------

  const addFiles = useCallback(async (files: File[]) => {
    const valid = files.filter((f) => {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)) return false
      if (f.size > MAX_FILE_SIZE) return false
      return true
    })
    if (valid.length === 0) return

    const newPending: PendingAttachment[] = valid.map((file) => ({
      key: `${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(file),
      file,
      status: "uploading",
    }))

    setPendingAttachments((prev) => [...prev, ...newPending])

    // Upload each file and update its status.
    await Promise.all(
      newPending.map(async (pending) => {
        try {
          const result = await uploadFile(pending.file)
          setPendingAttachments((prev) =>
            prev.map((a) =>
              a.key === pending.key
                ? { ...a, status: "ready", result }
                : a,
            ),
          )
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Upload failed"
          setPendingAttachments((prev) =>
            prev.map((a) =>
              a.key === pending.key
                ? { ...a, status: "error", errorMessage: msg }
                : a,
            ),
          )
        }
      }),
    )
  }, [])

  const removeAttachment = useCallback((key: string) => {
    setPendingAttachments((prev) => {
      const removed = prev.find((a) => a.key === key)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((a) => a.key !== key)
    })
  }, [])

  // -------------------------------------------------------------------------
  // Drag-and-drop
  // -------------------------------------------------------------------------

  const [isDragOver, setIsDragOver] = useState(false)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (
      [...(e.dataTransfer.items ?? [])].some((item) =>
        (ALLOWED_IMAGE_TYPES as readonly string[]).includes(item.type),
      )
    ) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = [...(e.dataTransfer.files ?? [])].filter((f) =>
      (ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type),
    )
    if (files.length > 0) void addFiles(files)
  }

  // -------------------------------------------------------------------------
  // Paste
  // -------------------------------------------------------------------------

  function handlePaste(e: React.ClipboardEvent) {
    const imageFiles = [...(e.clipboardData?.items ?? [])]
      .filter((item) =>
        (ALLOWED_IMAGE_TYPES as readonly string[]).includes(item.type),
      )
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)

    if (imageFiles.length > 0) {
      e.preventDefault()
      void addFiles(imageFiles)
    }
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    const readyAttachments = pendingAttachments.filter(
      (a): a is PendingAttachment & { status: "ready"; result: UploadResult } =>
        a.status === "ready",
    )

    if ((!text && readyAttachments.length === 0) || isBusy || isUploading) return
    if (atFreeLimit) {
      openUpgrade()
      return
    }

    // Build FileUIPart array for the AI SDK (uses signed URLs so Gemini can fetch them).
    const files: FileUIPart[] = readyAttachments.map((a) => ({
      type: "file",
      url: a.result.signedUrl,
      mediaType: a.result.mediaType,
      ...(a.result.filename ? { filename: a.result.filename } : {}),
    }))

    // Attachment metadata sent as extra body so the API can persist storagePaths.
    const attachments = readyAttachments.map((a) => ({
      storagePath: a.result.storagePath,
      mediaType: a.result.mediaType,
      sizeBytes: a.result.sizeBytes,
      ...(a.result.filename ? { filename: a.result.filename } : {}),
    }))

    sendMessage(
      { text, files: files.length > 0 ? files : undefined },
      files.length > 0 ? { body: { attachments } } : undefined,
    )

    setInput("")
    // Revoke preview URLs and clear the pending list.
    readyAttachments.forEach((a) => URL.revokeObjectURL(a.previewUrl))
    setPendingAttachments([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const canSend =
    !isBusy &&
    !isUploading &&
    (input.trim().length > 0 ||
      pendingAttachments.some((a) => a.status === "ready"))

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
          <p className="text-sm font-medium text-primary">Drop image here</p>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
          {messages.length === 0 && pendingAttachments.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 pt-24 text-center">
              <p className="text-sm text-muted-foreground">
                Send a message to start the conversation.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {awaitingReply && <TypingIndicator />}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              Something went wrong generating a response. Please try again.
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t bg-background">
        {atFreeLimit && (
          <div className="mx-auto w-full max-w-3xl px-4 pt-3">
            <button
              type="button"
              onClick={openUpgrade}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
            >
              You&apos;ve used all your free messages.{" "}
              <span className="font-semibold underline underline-offset-2">
                Sign up or log in
              </span>{" "}
              to keep chatting — your history is saved.
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-3xl p-4"
        >
          {/* Attachment previews */}
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingAttachments.map((att) => (
                <div
                  key={att.key}
                  className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.previewUrl}
                    alt="Attachment preview"
                    className="size-full object-cover"
                  />
                  {/* Uploading spinner overlay */}
                  {att.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                  {/* Error overlay */}
                  {att.status === "error" && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-destructive/40"
                      title={att.errorMessage}
                    >
                      <X className="size-4 text-white" />
                    </div>
                  )}
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.key)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground hover:bg-background"
                    aria-label="Remove attachment"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {hasUploadErrors && (
            <p className="mb-2 text-xs text-destructive">
              Some images failed to upload. Remove them and try again.
            </p>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            {/* File picker button */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              aria-label="Attach image"
              className="size-11 shrink-0 rounded-full"
            >
              <ImageIcon className="size-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                if (files.length > 0) void addFiles(files)
                // Reset so the same file can be re-picked after removal.
                e.target.value = ""
              }}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder={
                atFreeLimit
                  ? "Sign up to continue chatting…"
                  : "Message the assistant…"
              }
              className={cn(
                "flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-sm",
                "max-h-40 min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            />

            {isBusy ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => stop()}
                aria-label="Stop generating"
                className="size-11 shrink-0 rounded-full"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!canSend}
                aria-label="Send message"
                className="size-11 shrink-0 rounded-full"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
