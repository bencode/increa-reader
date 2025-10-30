import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import type { Message as MessageType } from '@/types/chat'
import { cn } from '@/lib/utils'
import { useExternalLinks } from '@/hooks/use-external-links'

type ToolParams = Record<string, unknown>

const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case 'Read':
      return '📖'
    case 'Grep':
      return '🔍'
    case 'Glob':
      return '📁'
    case 'TodoWrite':
      return '✏️'
    case 'Bash':
      return '⚡'
    default:
      return '🔧'
  }
}

const formatToolParams = (toolName: string, params?: ToolParams) => {
  if (!params) return ''
  switch (toolName) {
    case 'Read':
      return params.file_path?.split('/').pop() || ''
    case 'TodoWrite':
      return `${params.todos?.length || 0} items`
    case 'Grep':
      return params.pattern || ''
    case 'Glob':
      return params.pattern || ''
    case 'Bash':
      return params.command?.slice(0, 30) || ''
    default:
      return ''
  }
}

export const Message = ({ role, content, isStreaming, toolCalls }: MessageType) => {
  const prefix = role === 'user' ? '$' : role === 'system' ? '>' : role === 'error' ? '!' : '<'
  const textColor = role === 'user' ? 'text-blue-600 dark:text-blue-400' : role === 'error' ? 'text-red-700 dark:text-red-300' : ''
  const bgColor = role === 'error' ? 'bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500' : ''
  const syntaxTheme = oneDark
  const markdownRef = useExternalLinks()

  return (
    <div className={cn('py-2 px-4 font-mono text-sm', textColor, bgColor)}>
      <div className="flex gap-2">
        <span className="opacity-70">{prefix}</span>
        <div className="flex-1">
          {/* Tool calls display */}
          {toolCalls && toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {toolCalls.map((tool, i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded text-xs',
                    tool.status === 'running'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  )}
                >
                  <span>{getToolIcon(tool.name)}</span>
                  <span className="font-medium">{tool.name}</span>
                  {formatToolParams(tool.name, tool.params) && (
                    <span className="opacity-70">· {formatToolParams(tool.name, tool.params)}</span>
                  )}
                  {tool.status === 'running' && <span className="animate-pulse">●</span>}
                </span>
              ))}
            </div>
          )}

          {role === 'user' || role === 'system' || role === 'error' ? (
            <span>{content}</span>
          ) : (
            <div ref={markdownRef} className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-headings:text-base prose-headings:my-1 prose-h1:text-lg prose-h1:my-1.5 prose-h2:text-base prose-h2:my-1 prose-h3:text-sm prose-h3:my-1 prose-h4:text-sm prose-h4:my-0.5 prose-h5:text-xs prose-h5:my-0.5 prose-h6:text-xs prose-h6:my-0.5 prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter style={syntaxTheme} language={match[1]} PreTag="div" {...props}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={cn('bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200', className)} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </div>
      </div>
    </div>
  )
}
