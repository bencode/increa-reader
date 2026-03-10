import { useCallback, useEffect, useRef, useState } from 'react'

import { useGetContext } from '@/stores/view-context'
import { useSelectionQueue } from '@/contexts/selection-context'
import { ChatHeader } from './chat-header'
import { HistoryPanel } from './history-panel'
import { ActiveChatPanel } from './active-chat-panel'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useFrontendTools } from './hooks/use-frontend-tools'
import { useChat } from './hooks/use-chat'

export const ChatPanel = () => {
  const [isSplitView, setIsSplitView] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const getContext = useGetContext()
  const { items } = useSelectionQueue()
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items })

  const getContextWithQuotes = useCallback(() => ({
    ...getContext(),
    quoteCount: itemsRef.current.length,
  }), [getContext])

  const {
    messages,
    input,
    setInput,
    sessionId,
    isStreaming,
    repos,
    setRepos,
    stats,
    sendMessage,
    initializeFromStorage,
  } = useChat(getContextWithQuotes)

  useFrontendTools()

  // Initialize session from storage on mount
  useEffect(() => {
    initializeFromStorage()
  }, [])

  useEffect(() => {
    fetch('/api/workspace/tree')
      .then(res => res.json())
      .then(data => {
        const repoList = data.data || []
        setRepos(repoList)
      })
      .catch(console.error)
  }, [setRepos])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInsertText = useCallback((text: string) => {
    setInput(prev => {
      const separator = prev && !prev.endsWith('\n') ? '\n' : ''
      return prev + separator + text
    })
  }, [setInput])

  return (
    <div className="flex flex-col h-full font-mono">
      <ChatHeader isSplitView={isSplitView} onToggleSplit={() => setIsSplitView(!isSplitView)} />

      {isSplitView ? (
        <ResizablePanelGroup direction="vertical" className="flex-1">
          <ResizablePanel defaultSize={70} minSize={30}>
            <HistoryPanel messages={messages} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={30} minSize={20}>
            <ActiveChatPanel
              messages={messages}
              scrollRef={scrollRef}
              input={input}
              isStreaming={isStreaming}
              onInputChange={setInput}
              onKeyDown={handleKeyDown}
              onInsertText={handleInsertText}
              context={getContext()}
              repos={repos}
              sessionId={sessionId}
              stats={stats}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex-1 min-h-0">
          <ActiveChatPanel
            messages={messages}
            scrollRef={scrollRef}
            input={input}
            isStreaming={isStreaming}
            onInputChange={setInput}
            onKeyDown={handleKeyDown}
            onInsertText={handleInsertText}
            context={getContext()}
            repos={repos}
            sessionId={sessionId}
            stats={stats}
          />
        </div>
      )}
    </div>
  )
}
