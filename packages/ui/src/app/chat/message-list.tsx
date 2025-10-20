import { ScrollArea } from '@/components/ui/scroll-area'
import { Message } from './message'
import type { Message as MessageType } from '@/types/chat'

type MessageListProps = {
  messages: MessageType[]
  scrollRef: React.RefObject<HTMLDivElement>
}

export const MessageList = ({ messages, scrollRef }: MessageListProps) => {
  return (
    <ScrollArea className="flex-1 min-h-0 px-2 py-2">
      <div className="">
        {messages.map((msg, i) => (
          <Message key={i} {...msg} />
        ))}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  )
}
