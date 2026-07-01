"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Dialog } from "@base-ui/react/dialog"
import { MessageSquare, Search, SquarePen } from "lucide-react"
import { chatKeys, fetchChats, searchChats } from "@/lib/api/chats"
import { useAuth } from "@/providers/auth-provider"
import { useDebounce } from "@/hooks/use-debounce"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Command-palette-style modal for finding and jumping to a chat. */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)

  // Pre-fetch the chat list so the unfiltered state renders instantly.
  const { data: chats } = useQuery({
    queryKey: chatKeys.list(),
    queryFn: fetchChats,
    enabled: !!user,
  })

  // Use DB search when there's a non-empty query, otherwise show all chats.
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["chats", "search", debouncedQuery],
    queryFn: () => searchChats(debouncedQuery),
    enabled: !!user && debouncedQuery.length > 0,
    staleTime: 10_000,
  })

  const displayed = useMemo(() => {
    if (!debouncedQuery) {
      return (chats ?? []).map((c) => ({ id: c.id, title: c.title, snippet: null }))
    }
    return searchResults ?? []
  }, [debouncedQuery, chats, searchResults])

  function close() {
    onOpenChange(false)
    setQuery("")
  }

  function goToChat(id: string) {
    router.push(`/c/${id}`)
    close()
  }

  function newChat() {
    router.push("/")
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
            {isSearching && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={newChat}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <SquarePen className="size-4 shrink-0 text-muted-foreground" />
              New chat
            </button>

            {displayed.length > 0 && (
              <div className="mt-1 border-t pt-1">
                {displayed.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => goToChat(chat.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{chat.title ?? "New Chat"}</span>
                      {chat.snippet && (
                        <span className="truncate text-xs text-muted-foreground">
                          {chat.snippet}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {debouncedQuery && !isSearching && displayed.length === 0 && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                No chats match &ldquo;{debouncedQuery}&rdquo;.
              </p>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
