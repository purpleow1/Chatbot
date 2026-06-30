"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { chatKeys, createChat } from "@/lib/api/chats"

export default function HomePage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
      router.push(`/c/${newChat.id}`)
    },
  })

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <MessageSquarePlus className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold tracking-tight">
          Start a new conversation
        </h1>
        <p className="text-sm text-muted-foreground">
          Your chats will appear in the sidebar once you begin.
        </p>
      </div>
      <Button
        onClick={() => createMutation.mutate(undefined)}
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? "Creating…" : "New Chat"}
      </Button>
    </div>
  )
}
