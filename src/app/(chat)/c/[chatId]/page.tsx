import { MessageSquare } from "lucide-react"

type Props = {
  params: Promise<{ chatId: string }>
}

export default async function ChatPage({ params }: Props) {
  const { chatId } = await params

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <MessageSquare className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Chat <span className="font-mono text-xs">{chatId}</span>
      </p>
      <p className="text-xs text-muted-foreground/60">
        Streaming will be wired up in Phase 5.
      </p>
    </div>
  )
}
