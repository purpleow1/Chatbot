"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { FileUIPart } from "ai"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowUp, FileText, Paperclip, Square, X } from "lucide-react"
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
import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_SIZE,
  deleteDocument,
  documentKeys,
  fetchDocuments,
  isAcceptedDocument,
  uploadDocument,
} from "@/lib/api/documents"
import type { PendingDraft } from "@/lib/pending-draft"
import type { Document } from "@/lib/db/types"

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
  /**
   * The chat these attachments belong to. Documents require a chat, so when
   * this is undefined (home screen) attaching a document instead calls
   * `onNeedChatForDocuments` to create one first (Option A: eager creation).
   */
  chatId?: string
  /** Seed values restored from a handed-off draft (see `pending-draft`). */
  initialText?: string
  initialImageAttachments?: UploadResult[]
  initialDocumentFiles?: File[]
  /** Home-screen only: user attached documents but no chat exists yet. */
  onNeedChatForDocuments?: (draft: PendingDraft) => void
}

type PendingAttachment = {
  key: string
  previewUrl: string
  file?: File
} & (
  | { status: "uploading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; result: UploadResult }
)

/** A document currently uploading/ingesting (not yet in the server list). */
type PendingDoc = { key: string; filename: string }

const isImageFile = (f: File) =>
  (ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)

function readyAttachmentFromResult(result: UploadResult): PendingAttachment {
  return {
    key: `${Date.now()}-${Math.random()}`,
    previewUrl: result.signedUrl,
    status: "ready",
    result,
  }
}

export function Composer({
  onSend,
  isBusy = false,
  onStop,
  atFreeLimit = false,
  onBlocked,
  autoFocus = false,
  placeholder = "Message the assistant…",
  chatId,
  initialText,
  initialImageAttachments,
  initialDocumentFiles,
  onNeedChatForDocuments,
}: ComposerProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState(initialText ?? "")
  const [pendingImages, setPendingImages] = useState<PendingAttachment[]>(() =>
    (initialImageAttachments ?? []).map(readyAttachmentFromResult),
  )
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isUploadingImages = pendingImages.some((a) => a.status === "uploading")
  const hasUploadErrors = pendingImages.some((a) => a.status === "error")
  const isProcessingDocs = pendingDocs.length > 0

  // A chat's persisted documents (available as RAG context). Home screen has
  // no chat yet, so the query stays disabled there.
  const { data: serverDocs = [] } = useQuery({
    queryKey: chatId ? documentKeys.list(chatId) : documentKeys.list("none"),
    queryFn: () => fetchDocuments(chatId as string),
    enabled: !!chatId,
    staleTime: 30_000,
  })

  const removeDoc = useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.list(chatId) })
      }
    },
    onError: () => {
      toast.error("Couldn't remove document", { description: "Please try again." })
    },
  })

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

  // Revoke object URLs on unmount (no-op for restored http preview URLs).
  useEffect(() => {
    return () => {
      pendingImages.forEach((a) => URL.revokeObjectURL(a.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addImageFiles = useCallback(async (files: File[]) => {
    const rejected = files.filter(
      (f) => !isImageFile(f) || f.size > MAX_FILE_SIZE,
    )
    if (rejected.length > 0) {
      toast.error("Some images were skipped", {
        description: "Only images up to 5 MB (JPEG, PNG, GIF, WebP) are allowed.",
      })
    }

    const valid = files.filter((f) => isImageFile(f) && f.size <= MAX_FILE_SIZE)
    if (valid.length === 0) return

    const newPending: PendingAttachment[] = valid.map((file) => ({
      key: `${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(file),
      file,
      status: "uploading",
    }))

    setPendingImages((prev) => [...prev, ...newPending])

    await Promise.all(
      newPending.map(async (pending) => {
        try {
          const result = await uploadFile(pending.file!)
          setPendingImages((prev) =>
            prev.map((a) =>
              a.key === pending.key ? { ...a, status: "ready", result } : a,
            ),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed"
          toast.error("Image upload failed", { description: msg })
          setPendingImages((prev) =>
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

  const addDocumentFiles = useCallback(
    async (files: File[]) => {
      const valid: File[] = []
      for (const file of files) {
        if (!isAcceptedDocument(file)) {
          toast.error("Unsupported file", {
            description: `${file.name} — allowed: PDF, TXT, Markdown, DOCX.`,
          })
        } else if (file.size > MAX_DOCUMENT_SIZE) {
          toast.error("File too large", {
            description: `${file.name} exceeds the 10 MB limit.`,
          })
        } else {
          valid.push(file)
        }
      }
      if (valid.length === 0) return

      // No chat yet (home screen): hand the draft off so a chat is created,
      // then the chat view uploads these documents on mount.
      if (!chatId) {
        const readyImages = pendingImages
          .filter(
            (a): a is PendingAttachment & { status: "ready"; result: UploadResult } =>
              a.status === "ready",
          )
          .map((a) => a.result)
        onNeedChatForDocuments?.({
          text: input,
          imageAttachments: readyImages,
          documentFiles: valid,
        })
        return
      }

      await Promise.all(
        valid.map(async (file) => {
          const key = `${Date.now()}-${Math.random()}`
          setPendingDocs((prev) => [...prev, { key, filename: file.name }])
          try {
            await uploadDocument(chatId, file)
            await queryClient.invalidateQueries({
              queryKey: documentKeys.list(chatId),
            })
            toast.success("Document ready", {
              description: `${file.name} is now available as context.`,
            })
          } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed"
            toast.error("Couldn't add document", { description: message })
          } finally {
            setPendingDocs((prev) => prev.filter((p) => p.key !== key))
          }
        }),
      )
    },
    [chatId, input, pendingImages, onNeedChatForDocuments, queryClient],
  )

  // Upload any documents handed off from the home screen once, on mount.
  const didInitDocsRef = useRef(false)
  useEffect(() => {
    if (didInitDocsRef.current) return
    if (chatId && initialDocumentFiles && initialDocumentFiles.length > 0) {
      didInitDocsRef.current = true
      void addDocumentFiles(initialDocumentFiles)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  const handleFiles = useCallback(
    (files: File[]) => {
      const images = files.filter(isImageFile)
      const docs = files.filter((f) => !isImageFile(f))
      if (images.length > 0) void addImageFiles(images)
      if (docs.length > 0) void addDocumentFiles(docs)
    },
    [addImageFiles, addDocumentFiles],
  )

  const removeImage = useCallback((key: string) => {
    setPendingImages((prev) => {
      const removed = prev.find((a) => a.key === key)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((a) => a.key !== key)
    })
  }, [])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if ((e.dataTransfer.items?.length ?? 0) > 0) setIsDragOver(true)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = [...(e.dataTransfer.files ?? [])]
    if (files.length > 0) handleFiles(files)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageFiles = [...(e.clipboardData?.items ?? [])]
      .filter((item) => (ALLOWED_IMAGE_TYPES as readonly string[]).includes(item.type))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)

    if (imageFiles.length > 0) {
      e.preventDefault()
      void addImageFiles(imageFiles)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    const readyAttachments = pendingImages.filter(
      (a): a is PendingAttachment & { status: "ready"; result: UploadResult } =>
        a.status === "ready",
    )

    if ((!text && readyAttachments.length === 0) || isBusy) return
    if (isUploadingImages || isProcessingDocs) return
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
    setPendingImages([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const canSend =
    !isBusy &&
    !isUploadingImages &&
    !isProcessingDocs &&
    (input.trim().length > 0 || pendingImages.some((a) => a.status === "ready"))

  const hasPreviews =
    pendingImages.length > 0 || serverDocs.length > 0 || pendingDocs.length > 0

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
          <p className="text-sm font-medium text-primary">Drop files to attach</p>
        </div>
      )}

      {/* Attachment previews: images + documents */}
      {hasPreviews && (
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
          {pendingImages.map((att) => (
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
                onClick={() => removeImage(att.key)}
                className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 text-foreground hover:bg-background"
                aria-label="Remove attachment"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {serverDocs.map((doc) => (
            <DocumentChip
              key={doc.id}
              document={doc}
              onRemove={() => removeDoc.mutate(doc.id)}
              isRemoving={removeDoc.isPending && removeDoc.variables === doc.id}
            />
          ))}

          {pendingDocs.map((p) => (
            <div
              key={p.key}
              className="flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pr-2 pl-2.5 text-xs"
            >
              <span className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="max-w-[10rem] truncate text-muted-foreground">
                {p.filename}
              </span>
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
          aria-label="Attach image or document"
          title="Attach image or document"
          className="size-9 shrink-0 rounded-full"
        >
          <Paperclip className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={`${ALLOWED_IMAGE_TYPES.join(",")},${ACCEPTED_DOCUMENT_EXTENSIONS}`}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            if (files.length > 0) handleFiles(files)
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentChip({
  document,
  onRemove,
  isRemoving,
}: {
  document: Document
  onRemove: () => void
  isRemoving: boolean
}) {
  const failed = document.status === "failed"
  const processing = document.status === "processing"

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5 text-xs",
        failed
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "bg-muted/50",
      )}
      title={
        failed
          ? "Processing failed — remove and try again"
          : `${document.filename} · ${formatSize(document.size_bytes)}`
      }
    >
      {failed ? (
        <AlertCircle className="size-3.5 shrink-0" />
      ) : processing ? (
        <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      ) : (
        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={cn("max-w-[10rem] truncate", !failed && "text-foreground/80")}>
        {document.filename}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        aria-label={`Remove ${document.filename}`}
        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
