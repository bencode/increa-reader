import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PDFPage } from './pdf-page'
import type { PDFViewerProps } from './types'

export function PDFViewer({ repo, filePath, metadata }: PDFViewerProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: metadata.page_count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 1000,
    overscan: 2,
  })

  const items = rowVirtualizer.getVirtualItems()

  return (
    <div ref={parentRef} className="h-full overflow-auto" style={{ contain: 'strict' }}>
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
              onHeightChange={(pageNum, height) => {
                rowVirtualizer.measureElement(
                  parentRef.current?.querySelector(`[data-index="${pageNum - 1}"]`) || undefined
                )
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
