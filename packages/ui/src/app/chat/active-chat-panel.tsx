import type { ContextData } from '@/stores/view-context'
import type { Message, Repo } from '@/types/chat'
import { ChatInput } from './chat-input'
import { ChatMessages } from './chat-messages'
import { ChatStats } from './chat-stats'
import { QuoteBar } from './selection-queue-panel'

type ActiveChatPanelProps = {
  messages: Message[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  input: string
  isStreaming: boolean
  onInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onInsertText: (text: string) => void
  context: ContextData
  repos: Repo[]
  sessionId?: string
  model?: string | null
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
  onInsertText,
  context,
  repos,
  sessionId,
  model,
  stats,
}: ActiveChatPanelProps) => {
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <ChatMessages messages={messages} scrollRef={scrollRef} autoScroll={true} />
      <QuoteBar />
      <ChatInput
        input={input}
        isStreaming={isStreaming}
        onInputChange={onInputChange}
        onKeyDown={onKeyDown}
        onInsertText={onInsertText}
      />
      <ChatStats
        context={context}
        repos={repos}
        sessionId={sessionId}
        isStreaming={isStreaming}
        model={model}
        stats={stats}
      />
    </div>
  )
}
