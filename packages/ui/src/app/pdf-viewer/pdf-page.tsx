import { useState, useCallback, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import type { ViewMode, PDFPageData, PDFPageProps } from './types'

type PageToolbarProps = {
  pageNum: number
  viewMode: ViewMode
  pageData: PDFPageData | null
  onViewModeChange: (mode: ViewMode) => void
}

function PageToolbar({ pageNum, viewMode, pageData, onViewModeChange }: PageToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-4 pb-2 border-b">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>第 {pageNum} 页</span>
        {viewMode === 'markdown' && pageData && (
          <>
            <span>• 约 {pageData.estimated_reading_time} 分钟阅读</span>
            <div className="flex gap-2">
              {pageData.has_tables && <span>📊 表格</span>}
              {pageData.has_images && <span>🖼️ 图片</span>}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 bg-secondary/50 rounded p-0.5">
        <button
          onClick={() => onViewModeChange('svg')}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            viewMode === 'svg' ? 'bg-background shadow-sm font-medium' : 'hover:bg-background/50'
          }`}
          title="PDF 预览模式"
        >
          <ImageIcon className="w-3 h-3" />
          PDF
        </button>
        <button
          onClick={() => onViewModeChange('markdown')}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            viewMode === 'markdown'
              ? 'bg-background shadow-sm font-medium'
              : 'hover:bg-background/50'
          }`}
          title="Markdown 阅读模式"
        >
          <FileText className="w-3 h-3" />
          Markdown
        </button>
      </div>
    </div>
  )
}

function SVGContent({ repo, filePath, pageNum }: Pick<PDFPageProps, 'repo' | 'filePath' | 'pageNum'>) {
  return (
    <img
      src={`/api/pdf/page-render?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}&page=${pageNum}`}
      alt={`Page ${pageNum}`}
      className="w-full h-auto shadow-lg rounded"
      loading="lazy"
    />
  )
}

type MarkdownContentProps = {
  pageData: PDFPageData | null
  loading: boolean
  error: string | null
}

function MarkdownContent({ pageData, loading, error }: MarkdownContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">加载失败: {error}</p>
      </div>
    )
  }

  if (!pageData) return null

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:text-lg prose-headings:my-2 prose-h1:text-2xl prose-h1:my-3 prose-h2:text-xl prose-h2:my-2.5 prose-h3:text-lg prose-h3:my-2 prose-h4:text-base prose-h4:my-1.5 prose-h5:text-sm prose-h5:my-1 prose-h6:text-xs prose-h6:my-1 prose-p:my-1 prose-p:leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return match ? (
              <SyntaxHighlighter
                language={match[1]}
                style={vscDarkPlus}
                PreTag="div"
                customStyle={{ margin: 0, padding: 0, background: 'transparent' }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {pageData.body}
      </ReactMarkdown>
    </div>
  )
}

export function PDFPage({ repo, filePath, pageNum, onHeightChange }: PDFPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('svg')
  const [pageData, setPageData] = useState<PDFPageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const loadMarkdownData = useCallback(async () => {
    if (pageData || loading) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/pdf/page?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}&page=${pageNum}`
      )

      if (!response.ok) {
        throw new Error(`Failed to load page ${pageNum}`)
      }

      const data: PDFPageData = await response.json()
      setPageData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page')
      console.error(`Failed to load page ${pageNum}:`, err)
    } finally {
      setLoading(false)
    }
  }, [repo, filePath, pageNum, pageData, loading])

  useEffect(() => {
    if (viewMode === 'markdown') {
      loadMarkdownData()
    }
  }, [viewMode, loadMarkdownData])

  useEffect(() => {
    if (!contentRef.current || !onHeightChange) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        onHeightChange(pageNum, entry.contentRect.height)
      }
    })

    resizeObserver.observe(contentRef.current)
    return () => resizeObserver.disconnect()
  }, [pageNum, onHeightChange])

  return (
    <div ref={contentRef} className="p-6 min-w-0">
      <PageToolbar
        pageNum={pageNum}
        viewMode={viewMode}
        pageData={pageData}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'svg' ? (
        <SVGContent repo={repo} filePath={filePath} pageNum={pageNum} />
      ) : (
        <MarkdownContent pageData={pageData} loading={loading} error={error} />
      )}
    </div>
  )
}
