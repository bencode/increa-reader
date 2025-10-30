import { ChatMessages } from './chat-messages'
import type { Message } from '@/types/chat'

type HistoryPanelProps = {
  messages: Message[]
}

export const HistoryPanel = ({ messages }: HistoryPanelProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <ChatMessages messages={messages} autoScroll={false} />
    </div>
  )
}
