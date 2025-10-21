import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'

import { PDFPage } from './pdf-page'
import type { PDFViewerProps } from './types'
import { useSetContext } from '@/stores/view-context'

type PDFHeaderProps = {
  title: string
}

function PDFHeader({ title }: PDFHeaderProps) {
  return (
    <div className="border-b bg-background p-4">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold truncate flex-1 min-w-0">{title || '未命名文档'}</h2>
      </div>
    </div>
  )
}

type PDFPaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function PDFPagination({ currentPage, totalPages, onPageChange }: PDFPaginationProps) {
  const [inputPage, setInputPage] = useState(String(currentPage))

  useEffect(() => {
    setInputPage(String(currentPage))
  }, [currentPage])

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value)
  }

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(inputPage, 10)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    } else {
      setInputPage(String(currentPage))
    }
  }

  return (
    <div className="border-t bg-background p-3">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-2 rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          title="上一页"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <form onSubmit={handlePageSubmit} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">第</span>
          <input
            type="text"
            value={inputPage}
            onChange={handlePageInput}
            className="w-12 px-2 py-1 text-center text-sm border rounded focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">/ {totalPages} 页</span>
        </form>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-2 rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          title="下一页"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function PDFViewer({ repo, filePath, metadata }: PDFViewerProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const setContext = useSetContext()

  const rowVirtualizer = useVirtualizer({
    count: metadata.page_count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 1000,
    overscan: 2,
  })

  const items = rowVirtualizer.getVirtualItems()

  // 追踪可见项中间的页面
  useEffect(() => {
    if (items.length > 0) {
      const middleIndex = items[Math.floor(items.length / 2)].index
      setCurrentPage(middleIndex + 1)
    }
  }, [items])

  // 更新 context 中的页码
  useEffect(() => {
    setContext({ pageNumber: currentPage })
  }, [currentPage, setContext])

  // 跳转到指定页面
  const scrollToPage = (page: number) => {
    rowVirtualizer.scrollToIndex(page - 1, { align: 'center' })
  }

  // 提取文件名作为 fallback 标题
  const fileName = filePath.split('/').pop() || 'document.pdf'
  const displayTitle = metadata.title || fileName

  return (
    <div className="h-full flex flex-col">
      <PDFHeader title={displayTitle} />

      <div ref={parentRef} className="flex-1 overflow-auto" style={{ contain: 'strict' }}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {items.map(virtualItem => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <PDFPage
                repo={repo}
                filePath={filePath}
                pageNum={virtualItem.index + 1}
                onHeightChange={pageNum => {
                  rowVirtualizer.measureElement(
                    parentRef.current?.querySelector(`[data-index="${pageNum - 1}"]`) || undefined
                  )
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <PDFPagination
        currentPage={currentPage}
        totalPages={metadata.page_count}
        onPageChange={scrollToPage}
      />
    </div>
  )
}
