import { ScrollArea } from '@/components/ui/scroll-area'
import { Message } from './message'
import type { Message as MessageType } from '@/types/chat'

type ChatMessagesProps = {
  messages: MessageType[]
  scrollRef?: React.RefObject<HTMLDivElement | null>
  autoScroll?: boolean
}

export const ChatMessages = ({ messages, scrollRef, autoScroll = true }: ChatMessagesProps) => {
  return (
    <ScrollArea className="flex-1 min-h-0 px-2 py-2">
      <div className="">
        {messages.map((msg, i) => (
          <Message key={i} {...msg} />
        ))}
        {autoScroll && scrollRef && <div ref={scrollRef} />}
      </div>
    </ScrollArea>
  )
}
