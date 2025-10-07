import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import type { Message as MessageType } from '@/types/chat'
import { cn } from '@/lib/utils'

export const Message = ({ role, content, isStreaming }: MessageType) => {
  const prefix = role === 'user' ? '$' : role === 'system' ? '>' : role === 'error' ? '!' : '<'
  const textColor = role === 'user' ? 'text-green-400' : role === 'error' ? 'text-red-400' : 'text-blue-400'

  return (
    <div className={cn('py-2 px-4 font-mono text-sm', textColor)}>
      <div className="flex gap-2">
        <span className="opacity-70">{prefix}</span>
        <div className="flex-1">
          {role === 'user' || role === 'system' || role === 'error' ? (
            <span>{content}</span>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={cn('bg-green-950/30 px-1 rounded', className)} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          )}
          {isStreaming && <span className="animate-pulse">▊</span>}
        </div>
      </div>
    </div>
  )
}
