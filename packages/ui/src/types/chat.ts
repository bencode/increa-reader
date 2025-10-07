export type Message = {
  role: 'user' | 'assistant' | 'system' | 'error'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export type Repo = {
  name: string
  path: string
}
