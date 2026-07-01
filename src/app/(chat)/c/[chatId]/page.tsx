import { ChatView } from "@/components/chat/chat-view"

type Props = {
  params: Promise<{ chatId: string }>
}

export default async function ChatPage({ params }: Props) {
  const { chatId } = await params

  return <ChatView chatId={chatId} />
}
