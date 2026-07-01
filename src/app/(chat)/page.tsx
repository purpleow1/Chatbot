"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { chatKeys, createChat } from "@/lib/api/chats"
import { fetchUsage, usageKeys } from "@/lib/api/usage"
import { setPendingMessage } from "@/lib/pending-message"
import { Composer, type ComposerSubmitPayload } from "@/components/chat/composer"
import { useUpgrade } from "@/components/chat/upgrade"
import type { Chat } from "@/lib/db/types"

export default function HomePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { openUpgrade } = useUpgrade()

  const { data: usage } = useQuery({
    queryKey: usageKeys.detail(),
    queryFn: fetchUsage,
  })
  const atFreeLimit = usage?.isAnonymous === true && usage.remaining <= 0

  const createMutation = useMutation<Chat, Error, ComposerSubmitPayload>({
    mutationFn: () => createChat(),
    onSuccess: (chat, payload) => {
      // Stash the first message so the conversation view sends it on mount.
      setPendingMessage(chat.id, payload)
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
      router.push(`/c/${chat.id}`)
    },
    onError: () => {
      toast.error("Couldn't start a new chat", {
        description: "Please try again.",
      })
    },
  })

  function handleSend(payload: ComposerSubmitPayload) {
    if (createMutation.isPending) return
    if (atFreeLimit) {
      openUpgrade()
      return
    }
    createMutation.mutate(payload)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center px-4 pb-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What can I help with?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask anything, or attach an image to get started.
        </p>
      </div>

      <Composer
        onSend={handleSend}
        atFreeLimit={atFreeLimit}
        onBlocked={openUpgrade}
        autoFocus
        placeholder="Message the assistant…"
      />
    </div>
  )
}
