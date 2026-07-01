"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog } from "@base-ui/react/dialog"
import { MessageSquare, Search, SquarePen } from "lucide-react"
import { chatKeys, createChat, fetchChats } from "@/lib/api/chats"
import { useAuth } from "@/providers/auth-provider"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Command-palette-style modal for finding and jumping to a chat by title. */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [query, setQuery] = useState("")

  const { data: chats } = useQuery({
    queryKey: chatKeys.list(),
    queryFn: fetchChats,
    enabled: !!user,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = chats ?? []
    if (!q) return list
    return list.filter((c) => (c.title ?? "New Chat").toLowerCase().includes(q))
  }, [chats, query])

  const createMutation = useMutation({
    mutationFn: () => createChat(),
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
      router.push(`/c/${chat.id}`)
      close()
    },
  })

  function close() {
    onOpenChange(false)
    setQuery("")
  }

  function goToChat(id: string) {
    router.push(`/c/${id}`)
    close()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("")
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0" />
        <Dialog.Popup className="fixed top-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95">
          <Dialog.Title className="sr-only">Search chats</Dialog.Title>

          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <SquarePen className="size-4 shrink-0 text-muted-foreground" />
              New chat
            </button>

            {filtered.length > 0 && (
              <div className="mt-1 border-t pt-1">
                {filtered.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => goToChat(chat.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{chat.title ?? "New Chat"}</span>
                  </button>
                ))}
              </div>
            )}

            {chats && chats.length > 0 && filtered.length === 0 && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                No chats match “{query}”.
              </p>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
