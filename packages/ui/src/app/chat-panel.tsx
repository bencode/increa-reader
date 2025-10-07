import { useEffect, useRef, useState } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Message } from '@/components/chat/message'
import type { Message as MessageType, Repo } from '@/types/chat'

const HELP_TEXT = `Available commands:
  /cd <repo>   Switch to repo context
  /cd ~        Switch to all repos
  /pwd         Show current context
  /clear       Clear messages
  /help        Show this help

Examples:
  $ /cd increa-reader
  $ where is FileTree?
  $ /cd ~
`

const parseCommand = (input: string) => {
  const match = input.match(/^\/(\w+)(?:\s+(.*))?$/)
  if (!match) return null
  return {
    name: match[1],
    args: match[2]?.trim() || '',
  }
}

const extractTextContent = (msg: any): string => {
  if (msg.type === 'assistant' && msg.message?.content) {
    return msg.message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')
  }
  if (msg.type === 'stream_event' && msg.event?.type === 'content_block_delta') {
    return msg.event.delta?.text || ''
  }
  return ''
}

export const ChatPanel = () => {
  const [messages, setMessages] = useState<MessageType[]>([])
  const [input, setInput] = useState('')
  const [currentRepo, setCurrentRepo] = useState<string>('~')
  const [sessionId, setSessionId] = useState<string>()
  const [isStreaming, setIsStreaming] = useState(false)
  const [repos, setRepos] = useState<Repo[]>([])
  const [stats, setStats] = useState<{
    sessionId?: string
    duration?: number
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }>()
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource>()

  useEffect(() => {
    fetch('/api/workspace/tree')
      .then(res => res.json())
      .then(data => {
        setRepos(data.data || [])
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    const lastSessionId = localStorage.getItem('chat_session_id')
    if (lastSessionId) {
      const history = localStorage.getItem(`chat_history_${lastSessionId}`)
      if (history) {
        setMessages(JSON.parse(history))
        setSessionId(lastSessionId)
      }
    }
  }, [])

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('chat_session_id', sessionId)
      localStorage.setItem(`chat_history_${sessionId}`, JSON.stringify(messages))
    }
  }, [messages, sessionId])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (role: MessageType['role'], content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }])
  }

  const handleClear = () => {
    setMessages([])
    setSessionId(undefined)
    localStorage.removeItem('chat_session_id')
  }

  const handleCommand = (name: string, args: string) => {
    switch (name) {
      case 'cd':
        if (!args) {
          addMessage('error', 'Usage: /cd <repo|~>')
          return
        }
        if (args === '~') {
          setCurrentRepo('~')
          addMessage('system', 'Context → all repos')
        } else {
          const found = repos.find(r => r.name === args)
          if (found) {
            setCurrentRepo(args)
            addMessage('system', `Context → ${args}`)
          } else {
            addMessage('error', `Repo not found: ${args}`)
          }
        }
        break

      case 'pwd':
        addMessage('system', currentRepo === '~' ? 'all repos' : currentRepo)
        break

      case 'help':
        addMessage('system', HELP_TEXT)
        break

      case 'clear':
        handleClear()
        break

      default:
        addMessage('error', `Unknown command: /${name}. Type /help for available commands.`)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const normalized = input.replace(/^／/, '/')
    const cmd = parseCommand(normalized)

    if (cmd) {
      handleCommand(cmd.name, cmd.args)
      setInput('')
      return
    }

    const userMsg: MessageType = { role: 'user', content: input, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    let assistantContent = ''
    const assistantMsg: MessageType = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          sessionId,
          repo: currentRepo,
        }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const msg = JSON.parse(data)

              if (msg.type === 'system' && msg.subtype === 'init') {
                setSessionId(msg.session_id)
              }

              if (msg.type === 'assistant') {
                assistantContent = extractTextContent(msg)
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { ...assistantMsg, content: assistantContent, isStreaming: true },
                ])
              }

              if (msg.type === 'stream_event') {
                const deltaText = extractTextContent(msg)
                if (deltaText) {
                  assistantContent += deltaText
                  setMessages(prev => [
                    ...prev.slice(0, -1),
                    { ...assistantMsg, content: assistantContent, isStreaming: true },
                  ])
                }
              }

              if (msg.type === 'result') {
                // 更新统计信息
                setStats({
                  sessionId: msg.session_id,
                  duration: msg.duration_ms,
                  usage: msg.usage
                })

                setMessages(prev => [
                  ...prev.slice(0, -1),
                  {
                    ...assistantMsg,
                    content: assistantContent,
                    isStreaming: false,
                  },
                ])
                setIsStreaming(false)
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e)
            }
          }
        }
      }
    } catch (error) {
      addMessage('error', error instanceof Error ? error.message : 'Unknown error')
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full font-mono bg-gray-50 dark:bg-gray-900">
      {/* 统计信息头部 */}
      {stats && (stats.sessionId || stats.duration || stats.usage) && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              {stats.sessionId && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span className="font-mono">{stats.sessionId.slice(0, 8)}</span>
                </div>
              )}

              {stats.duration && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{(stats.duration / 1000).toFixed(1)}s</span>
                </div>
              )}

              {stats.usage && (
                <div className="flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">In:</span>
                    <span className="font-medium">{stats.usage.input_tokens.toLocaleString()}</span>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Out:</span>
                    <span className="font-medium">{stats.usage.output_tokens.toLocaleString()}</span>
                  </div>
                  {stats.usage.cache_creation_input_tokens && (
                    <div className="flex items-center gap-1">
                      <span className="text-blue-600 dark:text-blue-400">
                        +{stats.usage.cache_creation_input_tokens.toLocaleString()} cache
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {sessionId && (
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Active</span>
              </div>
            )}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 px-2 py-2">
        <div className="">
          {messages.map((msg, i) => (
            <Message key={i} {...msg} />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <span className="text-blue-600 dark:text-blue-400">user@{currentRepo === '~' ? '~' : currentRepo}</span>
        <span className="text-blue-700 dark:text-blue-500">$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none caret-blue-500 text-blue-700 dark:text-blue-300 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          placeholder="type /help for commands"
          spellCheck={false}
          disabled={isStreaming}
        />
      </div>
    </div>
  )
}
