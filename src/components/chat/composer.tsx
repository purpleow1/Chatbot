"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import type { FileUIPart } from "ai"
import { ArrowUp, ImagePlus, Square, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  uploadFile,
  type AttachmentInput,
  type UploadResult,
} from "@/lib/api/uploads"

export interface ComposerSubmitPayload {
  text: string
  files: FileUIPart[]
  attachments: AttachmentInput[]
}

interface ComposerProps {
  onSend: (payload: ComposerSubmitPayload) => void
  /** True while a response is streaming — swaps send for a stop button. */
  isBusy?: boolean
  onStop?: () => void
  /** Anonymous user has hit the free-message limit. */
  atFreeLimit?: boolean
  /** Called when a send is attempted while blocked (e.g. to open sign-up). */
  onBlocked?: () => void
  autoFocus?: boolean
  placeholder?: string
}

type PendingAttachment = {
  key: string
  previewUrl: string
  file: File
} & (
  | { status: "uploading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; result: UploadResult }
)

export function Composer({
  onSend,
  isBusy = false,
  onStop,
  atFreeLimit = false,
  onBlocked,
  autoFocus = false,
  placeholder = "Message the assistant…",
}: ComposerProps) {
  const [input, setInput] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isUploading = pendingAttachments.some((a) => a.status === "uploading")
  const hasUploadErrors = pendingAttachments.some((a) => a.status === "error")

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  // Auto-grow the textarea up to its max height.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((a) => URL.revokeObjectURL(a.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const rejected = files.filter(
      (f) =>
        !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type) ||
        f.size > MAX_FILE_SIZE,
    )
    if (rejected.length > 0) {
      toast.error("Some files were skipped", {
        description: "Only images up to 5 MB (JPEG, PNG, GIF, WebP) are allowed.",
      })
    }

    const valid = files.filter(
      (f) =>
        (ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type) &&
        f.size <= MAX_FILE_SIZE,
    )
    if (valid.length === 0) return

    const newPending: PendingAttachment[] = valid.map((file) => ({
      key: `${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(file),
      file,
      status: "uploading",
    }))

    setPendingAttachments((prev) => [...prev, ...newPending])

    await Promise.all(
      newPending.map(async (pending) => {
        try {
          const result = await uploadFile(pending.file)
          setPendingAttachments((prev) =>
            prev.map((a) =>
              a.key === pending.key ? { ...a, status: "ready", result } : a,
            ),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed"
          toast.error("Image upload failed", { description: msg })
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = [...(e.dataTransfer.files ?? [])].filter((f) =>
      (ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type),
    )
    if (files.length > 0) void addFiles(files)
  }

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    const readyAttachments = pendingAttachments.filter(
      (a): a is PendingAttachment & { status: "ready"; result: UploadResult } =>
        a.status === "ready",
    )

    if ((!text && readyAttachments.length === 0) || isBusy || isUploading) return
    if (atFreeLimit) {
      onBlocked?.()
      return
    }

    const files: FileUIPart[] = readyAttachments.map((a) => ({
      type: "file",
      url: a.result.signedUrl,
      mediaType: a.result.mediaType,
      ...(a.result.filename ? { filename: a.result.filename } : {}),
    }))

    const attachments: AttachmentInput[] = readyAttachments.map((a) => ({
      storagePath: a.result.storagePath,
      mediaType: a.result.mediaType,
      sizeBytes: a.result.sizeBytes,
      ...(a.result.filename ? { filename: a.result.filename } : {}),
    }))

    onSend({ text, files, attachments })

    setInput("")
    readyAttachments.forEach((a) => URL.revokeObjectURL(a.previewUrl))
    setPendingAttachments([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const canSend =
    !isBusy &&
    !isUploading &&
    (input.trim().length > 0 ||
      pendingAttachments.some((a) => a.status === "ready"))

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-3xl border bg-background shadow-sm transition-colors",
        isDragOver && "border-primary ring-2 ring-primary/30",
      )}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-primary/5">
          <p className="text-sm font-medium text-primary">Drop image to attach</p>
        </div>
      )}

      {/* Attachment previews */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
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
              {att.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              {att.status === "error" && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-destructive/40"
                  title={att.errorMessage}
                >
                  <X className="size-4 text-white" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(att.key)}
                className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 text-foreground hover:bg-background"
                aria-label="Remove attachment"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasUploadErrors && (
        <p className="px-4 pt-2 text-xs text-destructive">
          Some images failed to upload. Remove them and try again.
        </p>
      )}

      {/* Input row */}
      <div className="flex items-end gap-1.5 p-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          aria-label="Attach image"
          className="size-9 shrink-0 rounded-full"
        >
          <ImagePlus className="size-4" />
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
          placeholder={atFreeLimit ? "Sign up to continue chatting…" : placeholder}
          aria-label="Message input"
          className="max-h-[200px] min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
        />

        {isBusy ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => onStop?.()}
            aria-label="Stop generating"
            className="size-9 shrink-0 rounded-full"
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Send message"
            className="size-9 shrink-0 rounded-full"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </form>
  )
}
