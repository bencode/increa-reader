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
