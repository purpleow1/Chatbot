"use client"

import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, FileText, Paperclip, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_SIZE,
  deleteDocument,
  documentKeys,
  fetchDocuments,
  isAcceptedDocument,
  uploadDocument,
} from "@/lib/api/documents"
import type { Document } from "@/lib/db/types"

/** A file currently being uploaded/ingested (not yet in the server list). */
type PendingUpload = {
  key: string
  filename: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsBar({ chatId }: { chatId: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingUpload[]>([])

  const { data: documents = [] } = useQuery({
    queryKey: documentKeys.list(chatId),
    queryFn: () => fetchDocuments(chatId),
    staleTime: 30_000,
  })

  const removeMutation = useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(chatId) })
    },
    onError: () => {
      toast.error("Couldn't remove document", { description: "Please try again." })
    },
  })

  const addFiles = useCallback(
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

      await Promise.all(
        valid.map(async (file) => {
          const key = `${Date.now()}-${Math.random()}`
          setPending((prev) => [...prev, { key, filename: file.name }])
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
            setPending((prev) => prev.filter((p) => p.key !== key))
          }
        }),
      )
    },
    [chatId, queryClient],
  )

  const hasContent = documents.length > 0 || pending.length > 0

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          hasContent && "pb-2",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="h-7 gap-1.5 rounded-full px-3 text-xs"
        >
          <Paperclip className="size-3.5" />
          Add document
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_DOCUMENT_EXTENSIONS}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            if (files.length > 0) void addFiles(files)
            e.target.value = ""
          }}
        />

        {documents.map((doc) => (
          <DocumentChip
            key={doc.id}
            document={doc}
            onRemove={() => removeMutation.mutate(doc.id)}
            isRemoving={
              removeMutation.isPending && removeMutation.variables === doc.id
            }
          />
        ))}

        {pending.map((p) => (
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
    </div>
  )
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
      <span
        className={cn(
          "max-w-[10rem] truncate",
          !failed && "text-foreground/80",
        )}
      >
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
