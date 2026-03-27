import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { RefObject, ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { ListTree } from 'lucide-react'
import { useExternalLinks } from '@/hooks/use-external-links'
import { MermaidBlock } from '@/components/mermaid-block'
import { ArticleOutline } from './article-outline'
import { useHeadingObserver } from './use-heading-observer'
import { parseHeadings } from './heading-utils'

type MarkdownViewerProps = {
  body: string
  repoName: string
  filePath: string
  elementsRef: RefObject<Set<HTMLElement>>
}

function resolveImageSrc(src: string | undefined, repo: string, currentPath: string): string | undefined {
  if (!src) return src
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) return src
  const dir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
  const resolved = new URL(src, `http://x/${dir}`).pathname.slice(1)
  return `/api/raw/${repo}/${resolved}`
}

export function MarkdownViewer({ body, repoName, filePath, elementsRef }: MarkdownViewerProps) {
  const [showOutline, setShowOutline] = useState(true)
  const markdownRef = useExternalLinks()
  const scrollRef = useRef<HTMLDivElement>(null)

  const headings = useMemo(() => parseHeadings(body), [body])
  const activeId = useHeadingObserver(scrollRef, headings)

  // Assign IDs to rendered heading elements from parseHeadings (single source of truth)
  useEffect(() => {
    const container = markdownRef.current
    if (!container) return
    const els = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    els.forEach((el, i) => {
      if (headings[i]) el.id = headings[i].id
    })
  }, [headings, markdownRef])

  // IntersectionObserver for visible content tracking (chat/LLM feature)
  useEffect(() => {
    const scrollBody = scrollRef.current
    if (!scrollBody) return
    const elements = elementsRef.current
    elements.clear()
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            elementsRef.current.add(entry.target as HTMLElement)
          } else {
            elementsRef.current.delete(entry.target as HTMLElement)
          }
        }
      },
      { root: scrollBody, rootMargin: '100px', threshold: 0.1 },
    )
    const targets = scrollBody.querySelectorAll('.prose > *, pre, code')
    targets.forEach(el => observer.observe(el))
    return () => {
      observer.disconnect()
      elements.clear()
    }
  }, [body, elementsRef])

  const handleNavigate = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`#${CSS.escape(id)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const components = useMemo(() => ({
    img({ src, alt, ...props }: ComponentPropsWithoutRef<'img'>) {
      return <img src={resolveImageSrc(src, repoName, filePath)} alt={alt} {...props} />
    },
    code({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
      const match = /language-(\w+)/.exec(className || '')
      if (match?.[1] === 'mermaid') {
        return <MermaidBlock code={String(children).replace(/\n$/, '')} />
      }
      return match ? (
        <SyntaxHighlighter
          language={match[1]}
          /* @ts-expect-error SyntaxHighlighter style type mismatch */
          style={vscDarkPlus}
          PreTag="div"
          customStyle={{ margin: 0, padding: 0, background: 'transparent' }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>{children}</code>
      )
    },
  }), [repoName, filePath])

  const outlineVisible = showOutline && headings.length > 0

  return (
    <div className="flex h-full">
      <div ref={scrollRef} className="flex-1 min-w-0 overflow-auto scroll-body">
        <div
          ref={markdownRef}
          className="prose prose-slate dark:prose-invert max-w-none p-4 prose-headings:text-lg prose-headings:my-2 prose-h1:text-2xl prose-h1:my-3 prose-h2:text-xl prose-h2:my-2.5 prose-h3:text-lg prose-h3:my-2 prose-h4:text-base prose-h4:my-1.5 prose-h5:text-sm prose-h5:my-1 prose-h6:text-xs prose-h6:my-1 prose-p:my-1 prose-p:leading-relaxed"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={components}
          >
            {body}
          </ReactMarkdown>
        </div>
      </div>
      {outlineVisible && (
        <aside className="w-48 shrink-0 h-full border-l border-border overflow-y-auto">
          <ArticleOutline headings={headings} activeId={activeId} onNavigate={handleNavigate} />
        </aside>
      )}
      {headings.length > 0 && (
        <button
          onClick={() => setShowOutline(v => !v)}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/80 border border-border text-muted-foreground hover:text-foreground backdrop-blur-sm transition-colors"
          title={showOutline ? '隐藏大纲' : '显示大纲'}
        >
          <ListTree size={16} />
        </button>
      )}
    </div>
  )
}
