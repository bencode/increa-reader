import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { ChatStats } from './chat-stats'
import type { Message, Repo } from '@/types/chat'
import type { ContextData } from '@/stores/view-context'

type ActiveChatPanelProps = {
  messages: Message[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  input: string
  isStreaming: boolean
  onInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  context: ContextData
  repos: Repo[]
  sessionId?: string
  stats?: {
    sessionId?: string
    duration?: number
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

export const ActiveChatPanel = ({
  messages,
  scrollRef,
  input,
  isStreaming,
  onInputChange,
  onKeyDown,
  context,
  repos,
  sessionId,
  stats,
}: ActiveChatPanelProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <ChatMessages messages={messages} scrollRef={scrollRef} autoScroll={true} />
      <ChatInput
        input={input}
        isStreaming={isStreaming}
        onInputChange={onInputChange}
        onKeyDown={onKeyDown}
      />
      <ChatStats
        context={context}
        repos={repos}
        sessionId={sessionId}
        isStreaming={isStreaming}
        stats={stats}
      />
    </div>
  )
}
