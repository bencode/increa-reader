import { Palette, SquarePen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NOTE_COLORS, type NoteColor } from '@/types/notes'

type AnnotationToolbarProps = {
  placementColor: NoteColor | null
  onSelectColor: (color: NoteColor) => void
  onCancelPlacement: () => void
  disabled?: boolean
  disabledMessage?: string | null
  positionClassName?: string
}

const colorClassMap: Record<NoteColor, string> = {
  yellow: 'bg-[#F6E7A1] border-[#d9c267]',
  blue: 'bg-[#CFE5FF] border-[#91baf6]',
  green: 'bg-[#D7ECCC] border-[#9ec089]',
  pink: 'bg-[#F6D1DC] border-[#dca1b4]',
}

export function AnnotationToolbar({
  placementColor,
  onSelectColor,
  onCancelPlacement,
  disabled = false,
  disabledMessage,
  positionClassName = 'top-2 right-2',
}: AnnotationToolbarProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!placementColor) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancelPlacement()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [placementColor, onCancelPlacement])

  return (
    <div
      className={`pointer-events-auto absolute z-40 flex flex-col items-end gap-2 ${positionClassName}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          disabled={disabled}
          className={`flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${
            placementColor ? colorClassMap[placementColor] : ''
          }`}
          title="添加便利贴"
        >
          <SquarePen className="h-4 w-4" />
        </button>

        {placementColor && (
          <button
            type="button"
            onClick={() => {
              onCancelPlacement()
              setOpen(false)
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
            title="取消放置"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md">
          <Palette className="h-4 w-4 text-muted-foreground" />
          {NOTE_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => {
                onSelectColor(color)
                setOpen(false)
              }}
              className={`h-6 w-6 rounded-full border transition-transform hover:scale-105 ${colorClassMap[color]} ${
                placementColor === color
                  ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                  : ''
              }`}
              title={`选择${color}便签`}
            />
          ))}
        </div>
      )}

      {(placementColor || disabledMessage) && (
        <div className="max-w-56 rounded-lg border border-border/70 bg-background/90 px-3 py-2 text-right text-xs text-muted-foreground shadow-sm backdrop-blur">
          {placementColor ? '点击页面放置便签，拖到合适位置后保存，Esc 取消' : disabledMessage}
        </div>
      )}
    </div>
  )
}
