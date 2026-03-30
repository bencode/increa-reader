import { GripHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  type DocumentNote,
  type DraftDocumentNote,
  NOTE_COLORS,
  type NoteColor,
} from '@/types/notes'

type StickyNoteCardProps = {
  note: DocumentNote | DraftDocumentNote
  left: number
  top: number
  onMoveEnd: (layout: { left: number; top: number; width: number; height: number }) => void
  onChangeColor: (color: NoteColor) => Promise<void> | void
  onSave: (content: string) => Promise<void> | void
  onDelete: () => Promise<void> | void
  onCancel: () => void
}

const cardClassMap: Record<
  NoteColor,
  {
    body: string
    bodyActive: string
    header: string
    headerActive: string
    border: string
  }
> = {
  yellow: {
    body: 'bg-[#F6E7A1]/55',
    bodyActive: 'bg-[#F6E7A1]/82',
    header: 'bg-[#e8d481]/58',
    headerActive: 'bg-[#e8d481]/78',
    border: 'border-[#d9c267]/55',
  },
  blue: {
    body: 'bg-[#CFE5FF]/50',
    bodyActive: 'bg-[#CFE5FF]/80',
    header: 'bg-[#b6d7fb]/52',
    headerActive: 'bg-[#b6d7fb]/75',
    border: 'border-[#91baf6]/50',
  },
  green: {
    body: 'bg-[#D7ECCC]/52',
    bodyActive: 'bg-[#D7ECCC]/80',
    header: 'bg-[#c3dfb4]/55',
    headerActive: 'bg-[#c3dfb4]/76',
    border: 'border-[#9ec089]/52',
  },
  pink: {
    body: 'bg-[#F6D1DC]/50',
    bodyActive: 'bg-[#F6D1DC]/78',
    header: 'bg-[#ebbed0]/54',
    headerActive: 'bg-[#ebbed0]/74',
    border: 'border-[#dca1b4]/50',
  },
}

export function StickyNoteCard({
  note,
  left,
  top,
  onMoveEnd,
  onChangeColor,
  onSave,
  onDelete,
  onCancel,
}: StickyNoteCardProps) {
  const palette = cardClassMap[note.color as NoteColor] ?? cardClassMap.yellow
  const [isEditing, setIsEditing] = useState('isDraft' in note && note.isDraft)
  const [draftContent, setDraftContent] = useState(note.content)
  const [dragPosition, setDragPosition] = useState<{ left: number; top: number } | null>(null)
  const dragPositionRef = useRef<{ left: number; top: number } | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    originLeft: number
    originTop: number
  } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const effectiveLeft = dragPosition?.left ?? left
  const effectiveTop = dragPosition?.top ?? top

  useEffect(() => {
    setDraftContent(note.content)
  }, [note.content])

  useEffect(() => {
    if ('isDraft' in note && note.isDraft) {
      setIsEditing(true)
    }
  }, [note])

  useEffect(() => {
    setDragPosition(null)
    dragPositionRef.current = null
  }, [left, top])

  const commitContent = async (content: string) => {
    const trimmed = content.trim()
    if ('isDraft' in note && note.isDraft && !trimmed) {
      onCancel()
      return
    }
    await onSave(content)
    if (!('isDraft' in note && note.isDraft)) {
      setIsEditing(false)
    }
  }

  const revertEditing = () => {
    if ('isDraft' in note && note.isDraft) {
      onCancel()
      return
    }
    setDraftContent(note.content)
    setIsEditing(false)
  }

  const finishDrag = () => {
    dragRef.current = null
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const finalPosition = dragPositionRef.current ?? { left, top }
    onMoveEnd({
      left: finalPosition.left,
      top: finalPosition.top,
      width: rect.width,
      height: rect.height,
    })
    setDragPosition(null)
    dragPositionRef.current = null
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originLeft: effectiveLeft,
      originTop: effectiveTop,
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return
      const nextPosition = {
        left: dragRef.current.originLeft + (moveEvent.clientX - dragRef.current.startX),
        top: dragRef.current.originTop + (moveEvent.clientY - dragRef.current.startY),
      }
      dragPositionRef.current = nextPosition
      setDragPosition(nextPosition)
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      finishDrag()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const bodyClass = isEditing ? palette.bodyActive : palette.body
  const headerClass = isEditing ? palette.headerActive : palette.header

  return (
    <div
      ref={cardRef}
      data-note-card="true"
      className={`absolute z-20 w-56 rounded-xl border shadow-md transition-shadow ${
        dragPosition ? 'shadow-xl' : 'shadow-sm'
      } ${bodyClass} ${palette.border} backdrop-blur-[1px]`}
      style={{ left: effectiveLeft, top: effectiveTop }}
      onClick={event => {
        event.stopPropagation()
        if (!isEditing) setIsEditing(true)
      }}
    >
      <div
        className={`flex cursor-grab items-center justify-between rounded-t-xl border-b px-3 py-2 ${headerClass} ${palette.border}`}
        onPointerDown={handlePointerDown}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <GripHorizontal className="h-3.5 w-3.5" />
            便利贴
          </div>
          <div className="flex items-center gap-1.5">
            {NOTE_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={async event => {
                  event.stopPropagation()
                  await onChangeColor(color)
                }}
                className={`h-3.5 w-3.5 rounded-full border border-black/10 transition-transform hover:scale-110 ${
                  cardClassMap[color].body
                } ${note.color === color ? 'ring-2 ring-slate-700/60 ring-offset-1 ring-offset-transparent' : ''}`}
                title={`切换为${color}`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={async event => {
            event.stopPropagation()
            await onDelete()
          }}
          className="rounded-md p-1 text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-900"
          title="删除便签"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3 p-3">
          <textarea
            autoFocus
            value={draftContent}
            onChange={event => setDraftContent(event.target.value)}
            onClick={event => event.stopPropagation()}
            onBlur={async event => {
              const nextTarget = event.relatedTarget
              if (nextTarget instanceof HTMLElement && cardRef.current?.contains(nextTarget)) {
                return
              }
              await commitContent(draftContent)
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                revertEditing()
              }
            }}
            className="min-h-28 w-full resize-none rounded-lg border border-black/10 bg-white/72 p-2 text-sm outline-none ring-0 placeholder:text-slate-500"
            placeholder="写点想法..."
          />
          <div className="text-[11px] text-slate-600">点击别处自动保存，按 Esc 取消修改</div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap break-words p-3 text-sm text-slate-800">
          {note.content}
        </div>
      )}
    </div>
  )
}
