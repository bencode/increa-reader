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
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource>()

  useEffect(() => {
    fetch('/api/workspace/tree')
      .then(res => res.json())
      .then(data => {
        setRepos(data.repos || [])
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
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { ...assistantMsg, content: assistantContent, isStreaming: false },
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
    <div className="flex flex-col h-full bg-black text-green-400 font-mono text-sm">
      <div className="px-4 py-2 border-b border-green-900/50 text-xs opacity-60">
        claude-code session [{new Date().toLocaleTimeString()}]
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        {messages.map((msg, i) => (
          <Message key={i} {...msg} />
        ))}
        <div ref={scrollRef} />
      </ScrollArea>

      <div className="px-4 py-3 border-t border-green-900/50 flex items-center gap-2">
        <span className="text-green-500">user@{currentRepo === '~' ? '~' : currentRepo}</span>
        <span className="text-green-600">$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none caret-green-400"
          placeholder="type /help for commands"
          spellCheck={false}
          disabled={isStreaming}
        />
      </div>
    </div>
  )
}
