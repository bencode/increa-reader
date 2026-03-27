import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { StickyNoteCard } from './sticky-note-card'
import { useDocumentNotes } from './use-document-notes'
import {
  buildMarkdownLocator,
  clamp,
  collectMarkdownBlocks,
  createDraftMarkdownNote,
  findBestMarkdownBlock,
  nearestMarkdownBlockFromClientPoint,
  nearestMarkdownBlockFromPoint,
  type MarkdownBlockMeta,
} from './note-utils'
import { useNoteToolStore } from '@/stores/note-tool-store'
import type {
  DocumentNote,
  DraftDocumentNote,
  MarkdownNotePosition,
  NoteColor,
} from '@/types/notes'

type ResolvedNote = {
  note: DocumentNote<MarkdownNotePosition> | DraftDocumentNote<MarkdownNotePosition>
  left: number
  top: number
  block: MarkdownBlockMeta
  visible: boolean
}

type MarkdownNotesLayerProps = {
  repoName: string
  filePath: string
  contentRef: RefObject<HTMLDivElement | null>
  markdownRef: RefObject<HTMLDivElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
}

const DEFAULT_NOTE_COLOR: NoteColor = 'yellow'

export function MarkdownNotesLayer({
  repoName,
  filePath,
  contentRef,
  markdownRef,
  scrollRef,
}: MarkdownNotesLayerProps) {
  const { notes, createNote, updateNote, deleteNote } = useDocumentNotes<MarkdownNotePosition>(
    repoName,
    filePath,
    'markdown',
  )
  const [draftNotes, setDraftNotes] = useState<DraftDocumentNote<MarkdownNotePosition>[]>([])
  const [resolvedNotes, setResolvedNotes] = useState<ResolvedNote[]>([])
  const blocksRef = useRef<MarkdownBlockMeta[]>([])

  useEffect(() => {
    setDraftNotes([])
    setResolvedNotes([])
  }, [repoName, filePath])

  const allNotes = useMemo(
    () => [...notes, ...draftNotes] as Array<DocumentNote<MarkdownNotePosition> | DraftDocumentNote<MarkdownNotePosition>>,
    [notes, draftNotes],
  )

  const recomputeLayout = useCallback(() => {
    const markdownRoot = markdownRef.current
    const content = contentRef.current
    const scrollContainer = scrollRef.current
    if (!markdownRoot || !content || !scrollContainer) return

    const blocks = collectMarkdownBlocks(markdownRoot)
    blocksRef.current = blocks

    const containerRect = content.getBoundingClientRect()
    const scrollRect = scrollContainer.getBoundingClientRect()

    const nextResolved = allNotes
      .map(note => {
        const block = findBestMarkdownBlock(blocks, note.position)
        if (!block) return null

        const rect = block.element.getBoundingClientRect()
        const left = rect.left - containerRect.left + rect.width * note.position.xRatio
        const top = rect.top - containerRect.top + rect.height * note.position.yRatio
        const visible = rect.bottom >= scrollRect.top && rect.top <= scrollRect.bottom

        return {
          note,
          left,
          top,
          block,
          visible,
        } satisfies ResolvedNote
      })
      .filter((note): note is ResolvedNote => note !== null)

    setResolvedNotes(nextResolved)

    const persistedResolved = nextResolved.filter(
      item => !('isDraft' in item.note && item.note.isDraft),
    ) as Array<ResolvedNote & { note: DocumentNote<MarkdownNotePosition> }>

    useNoteToolStore.getState().setNotes(persistedResolved.map(item => buildMarkdownLocator(item.note)))
    useNoteToolStore.getState().setVisibleNotes(
      persistedResolved
        .filter(item => item.visible)
        .map(item => buildMarkdownLocator(item.note)),
    )
  }, [allNotes, contentRef, markdownRef, scrollRef])

  useEffect(() => {
    recomputeLayout()
  }, [recomputeLayout])

  useEffect(() => {
    const content = contentRef.current
    const scrollContainer = scrollRef.current
    if (!content || !scrollContainer) return

    const resizeObserver = new ResizeObserver(() => recomputeLayout())
    resizeObserver.observe(content)
    resizeObserver.observe(scrollContainer)

    const handleScroll = () => recomputeLayout()
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      resizeObserver.disconnect()
      scrollContainer.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [contentRef, scrollRef, recomputeLayout])

  const createDraftAtPoint = useCallback((clientX: number, clientY: number, target: EventTarget | null) => {
    const markdownRoot = markdownRef.current
    if (!markdownRoot) return

    const block = (target
      ? blocksRef.current.find(candidate =>
          candidate.element === target || candidate.element.contains(target as Node),
        )
      : null) ?? nearestMarkdownBlockFromClientPoint(blocksRef.current, clientX, clientY)
    if (!block) return

    const blockRect = block.element.getBoundingClientRect()
    const position: MarkdownNotePosition = {
      headingPath: block.headingPath,
      blockText: block.text,
      blockIndex: block.index,
      xRatio: clamp((clientX - blockRect.left) / Math.max(blockRect.width, 1)),
      yRatio: clamp((clientY - blockRect.top) / Math.max(blockRect.height, 1)),
    }

    setDraftNotes(prev => [...prev, createDraftMarkdownNote(DEFAULT_NOTE_COLOR, position)])
  }, [markdownRef])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-note-card="true"]')) return
      createDraftAtPoint(event.clientX, event.clientY, target)
    }

    content.addEventListener('dblclick', handleDoubleClick)
    return () => content.removeEventListener('dblclick', handleDoubleClick)
  }, [contentRef, createDraftAtPoint])

  const handleSaveDraft = useCallback(async (note: DraftDocumentNote<MarkdownNotePosition>, content: string) => {
    if (!content.trim()) {
      setDraftNotes(prev => prev.filter(item => item.id !== note.id))
      return
    }
    const created = await createNote({
      color: note.color,
      content,
      position: note.position,
    })
    setDraftNotes(prev => prev.filter(item => item.id !== note.id))
    setResolvedNotes(prev => prev.filter(item => item.note.id !== note.id))
    useNoteToolStore.getState().setNotes([
      ...useNoteToolStore.getState().notes,
      buildMarkdownLocator(created),
    ])
  }, [createNote])

  const handleMove = useCallback((
    noteId: string,
    layout: { left: number; top: number; width: number; height: number },
  ) => {
    const content = contentRef.current
    if (!content) return

    const blocks = blocksRef.current
    const containerRect = content.getBoundingClientRect()
    const block = nearestMarkdownBlockFromPoint(blocks, containerRect, layout)
    if (!block) return

    const blockRect = block.element.getBoundingClientRect()
    const blockLeft = blockRect.left - containerRect.left
    const blockTop = blockRect.top - containerRect.top

    const nextPosition: MarkdownNotePosition = {
      headingPath: block.headingPath,
      blockText: block.text,
      blockIndex: block.index,
      xRatio: (layout.left - blockLeft) / Math.max(blockRect.width, 1),
      yRatio: (layout.top - blockTop) / Math.max(blockRect.height, 1),
    }

    const draft = draftNotes.find(item => item.id === noteId)
    if (draft) {
      setDraftNotes(prev => prev.map(item => item.id === noteId ? { ...item, position: nextPosition } : item))
      return
    }

    const existing = notes.find(item => item.id === noteId)
    if (!existing) return
    void updateNote(noteId, {
      color: existing.color,
      content: existing.content,
      position: nextPosition,
    })
  }, [contentRef, draftNotes, notes, updateNote])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-0 pointer-events-none">
        {resolvedNotes.map(item => (
          <div key={item.note.id} className="pointer-events-auto">
            <StickyNoteCard
              note={item.note}
              left={item.left}
              top={item.top}
              onMoveEnd={layout => handleMove(item.note.id, layout)}
              onChangeColor={async color => {
                if ('isDraft' in item.note && item.note.isDraft) {
                  setDraftNotes(prev => prev.map(note => note.id === item.note.id ? { ...note, color } : note))
                  return
                }
                await updateNote(item.note.id, {
                  color,
                  content: item.note.content,
                  position: item.note.position,
                })
              }}
              onSave={async content => {
                if ('isDraft' in item.note && item.note.isDraft) {
                  await handleSaveDraft(item.note, content)
                  return
                }
                await updateNote(item.note.id, {
                  color: item.note.color,
                  content,
                  position: item.note.position,
                })
              }}
              onDelete={async () => {
                if ('isDraft' in item.note && item.note.isDraft) {
                  setDraftNotes(prev => prev.filter(note => note.id !== item.note.id))
                  return
                }
                await deleteNote(item.note.id)
              }}
              onCancel={() => {
                if ('isDraft' in item.note && item.note.isDraft) {
                  setDraftNotes(prev => prev.filter(note => note.id !== item.note.id))
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
