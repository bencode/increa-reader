import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import type { Message as MessageType } from '@/types/chat'
import { cn } from '@/lib/utils'

export const Message = ({ role, content, isStreaming }: MessageType) => {
  const prefix = role === 'user' ? '$' : role === 'system' ? '>' : role === 'error' ? '!' : '<'
  const textColor = role === 'user' ? 'text-blue-600 dark:text-blue-400' : role === 'error' ? 'text-red-500' : ''
  const syntaxTheme = oneDark

  return (
    <div className={cn('py-2 px-4 font-mono text-sm', textColor)}>
      <div className="flex gap-2">
        <span className="opacity-70">{prefix}</span>
        <div className="flex-1">
          {role === 'user' || role === 'system' || role === 'error' ? (
            <span>{content}</span>
          ) : (
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-headings:text-base prose-headings:my-1 prose-h1:text-lg prose-h1:my-1.5 prose-h2:text-base prose-h2:my-1 prose-h3:text-sm prose-h3:my-1 prose-h4:text-sm prose-h4:my-0.5 prose-h5:text-xs prose-h5:my-0.5 prose-h6:text-xs prose-h6:my-0.5 prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
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
