import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import type { DocumentNote, DraftDocumentNote, NoteColor, PDFNotePosition } from '@/types/notes'
import { clamp } from './note-utils'
import { StickyNoteCard } from './sticky-note-card'

type NoteWithDraft = DocumentNote<PDFNotePosition> | DraftDocumentNote<PDFNotePosition>

type PDFNotesLayerProps = {
  pageNum: number
  notes: NoteWithDraft[]
  containerRef: RefObject<HTMLDivElement | null>
  onCreateDraft: (page: number, xRatio: number, yRatio: number) => void
  onMoveNote: (noteId: string, position: PDFNotePosition) => void
  onChangeColor: (noteId: string, color: NoteColor) => Promise<void> | void
  onSaveDraft: (note: DraftDocumentNote<PDFNotePosition>, content: string) => Promise<void>
  onSaveNote: (note: DocumentNote<PDFNotePosition>, content: string) => Promise<void>
  onDeleteDraft: (noteId: string) => void
  onDeleteNote: (noteId: string) => Promise<void>
}

export function PDFNotesLayer({
  pageNum,
  notes,
  containerRef,
  onCreateDraft,
  onMoveNote,
  onChangeColor,
  onSaveDraft,
  onSaveNote,
  onDeleteDraft,
  onDeleteNote,
}: PDFNotesLayerProps) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setSize({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-note-card="true"]')) return
      const rect = container.getBoundingClientRect()
      onCreateDraft(
        pageNum,
        clamp((event.clientX - rect.left) / Math.max(rect.width, 1)),
        clamp((event.clientY - rect.top) / Math.max(rect.height, 1)),
      )
    }

    container.addEventListener('dblclick', handleDoubleClick)
    return () => container.removeEventListener('dblclick', handleDoubleClick)
  }, [containerRef, onCreateDraft, pageNum])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-0 pointer-events-none">
        {notes.map(note => (
          <div key={note.id} className="pointer-events-auto">
            <StickyNoteCard
              note={note}
              left={note.position.xRatio * size.width}
              top={note.position.yRatio * size.height}
              onMoveEnd={layout => {
                const width = size.width || 1
                const height = size.height || 1
                onMoveNote(note.id, {
                  page: pageNum,
                  xRatio: clamp(layout.left / width),
                  yRatio: clamp(layout.top / height),
                })
              }}
              onChangeColor={color => onChangeColor(note.id, color)}
              onSave={content =>
                'isDraft' in note && note.isDraft
                  ? onSaveDraft(note, content)
                  : onSaveNote(note as DocumentNote<PDFNotePosition>, content)
              }
              onDelete={() =>
                'isDraft' in note && note.isDraft ? onDeleteDraft(note.id) : onDeleteNote(note.id)
              }
              onCancel={() => {
                if ('isDraft' in note && note.isDraft) {
                  onDeleteDraft(note.id)
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
