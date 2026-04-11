import { useVirtualizer } from '@tanstack/react-virtual'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createDraftPDFNote } from '@/app/notes/note-utils'
import { useDocumentNotes } from '@/app/notes/use-document-notes'
import { useNoteToolStore } from '@/stores/note-tool-store'
import { makeTabId, useTabsStore } from '@/stores/tabs-store'
import type { DraftDocumentNote, PDFNotePosition } from '@/types/notes'
import { SelectionToolbar } from '../selection/selection-toolbar'
import { PDFPage } from './pdf-page'
import type { PDFViewerProps, ViewMode } from './types'

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
          type="button"
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
          type="button"
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

const ESTIMATED_PAGE_SIZE = 1000

export function PDFViewer({ repo, filePath, metadata }: PDFViewerProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const tabId = makeTabId(repo, filePath)
  const [initialPage] = useState(
    () => useTabsStore.getState().tabs.find(t => t.id === tabId)?.pageNumber ?? 1,
  )
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [viewMode, setViewMode] = useState<ViewMode>('svg')
  const [draftNotes, setDraftNotes] = useState<DraftDocumentNote<PDFNotePosition>[]>([])
  const { notes, createNote, updateNote, deleteNote } = useDocumentNotes<PDFNotePosition>(
    repo,
    filePath,
    'pdf',
  )

  const rowVirtualizer = useVirtualizer({
    count: metadata.page_count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_PAGE_SIZE,
    overscan: 2,
    initialOffset: (initialPage - 1) * ESTIMATED_PAGE_SIZE,
  })

  const items = rowVirtualizer.getVirtualItems()

  useEffect(() => {
    if (items.length > 0) {
      const middleIndex = items[Math.floor(items.length / 2)].index
      setCurrentPage(middleIndex + 1)
    }
  }, [items])

  useEffect(() => {
    useTabsStore.getState().setPageNumber(tabId, currentPage)
  }, [currentPage, tabId])

  const scrollToPage = (page: number) => {
    rowVirtualizer.scrollToIndex(page - 1, { align: 'center' })
  }

  const fileName = filePath.split('/').pop() || 'document.pdf'
  const displayTitle = metadata.title || fileName

  useEffect(() => {
    const standardized = notes.map(note => ({
      id: note.id,
      color: note.color,
      content: note.content,
      locator: {
        label: `Page ${note.position.page}`,
        page: note.position.page,
        headingPath: null,
        anchorText: null,
      },
      updatedAt: note.updatedAt,
    }))

    useNoteToolStore.getState().setNotes(standardized)
    useNoteToolStore
      .getState()
      .setVisibleNotes(standardized.filter(note => note.locator.page === currentPage))
  }, [notes, currentPage])

  useEffect(() => {
    setDraftNotes([])
  }, [repo, filePath])

  const handleCreateDraft = (page: number, xRatio: number, yRatio: number) => {
    setDraftNotes(prev => [...prev, createDraftPDFNote('yellow', { page, xRatio, yRatio })])
  }

  return (
    <div className="relative h-full flex flex-col">
      <PDFHeader title={displayTitle} />

      <SelectionToolbar containerRef={parentRef} />
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
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                notes={notes.filter(note => note.position.page === virtualItem.index + 1)}
                draftNotes={draftNotes.filter(note => note.position.page === virtualItem.index + 1)}
                onCreateDraft={viewMode === 'svg' ? handleCreateDraft : undefined}
                onMoveNote={(noteId, position) => {
                  const draft = draftNotes.find(note => note.id === noteId)
                  if (draft) {
                    setDraftNotes(prev =>
                      prev.map(note => (note.id === noteId ? { ...note, position } : note)),
                    )
                    return
                  }

                  const existing = notes.find(note => note.id === noteId)
                  if (!existing) return
                  void updateNote(noteId, {
                    color: existing.color,
                    content: existing.content,
                    position,
                  })
                }}
                onChangeColor={async (noteId, color) => {
                  const draft = draftNotes.find(note => note.id === noteId)
                  if (draft) {
                    setDraftNotes(prev =>
                      prev.map(note => (note.id === noteId ? { ...note, color } : note)),
                    )
                    return
                  }

                  const existing = notes.find(note => note.id === noteId)
                  if (!existing) return
                  await updateNote(noteId, {
                    color,
                    content: existing.content,
                    position: existing.position,
                  })
                }}
                onSaveDraft={async (note, content) => {
                  if (!content.trim()) {
                    setDraftNotes(prev => prev.filter(item => item.id !== note.id))
                    return
                  }
                  await createNote({
                    color: note.color,
                    content,
                    position: note.position,
                  })
                  setDraftNotes(prev => prev.filter(item => item.id !== note.id))
                }}
                onSaveNote={async (note, content) => {
                  await updateNote(note.id, {
                    color: note.color,
                    content,
                    position: note.position,
                  })
                }}
                onDeleteDraft={noteId => {
                  setDraftNotes(prev => prev.filter(note => note.id !== noteId))
                }}
                onDeleteNote={deleteNote}
                onHeightChange={pageNum => {
                  rowVirtualizer.measureElement(
                    parentRef.current?.querySelector(`[data-index="${pageNum - 1}"]`) || undefined,
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
