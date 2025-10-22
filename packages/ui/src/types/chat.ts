export type ToolCall = {
  name: string
  status: 'running' | 'done'
  params?: Record<string, unknown>
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'error'
  content: string
  timestamp: number
  isStreaming?: boolean
  toolCalls?: ToolCall[]
  sessionId?: string
  duration?: number
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export type Repo = {
  name: string
  path: string
}

export type SSEMessage =
  | { type: 'system'; subtype: 'init'; session_id: string }
  | { type: 'stream_event'; event: { delta?: { type: string; text?: string; partial_json?: string } } }
  | { type: 'assistant'; content: string }
  | { type: 'result'; session_id: string; duration_ms: number; usage: Message['usage'] }
  | { type: 'error'; message: string }
  | { type: 'tool_call'; call_id: string; name: string; arguments: Record<string, unknown> }
