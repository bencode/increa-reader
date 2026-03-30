import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { collectSelectionContext, useSelectionQueue } from '@/contexts/selection-context'
import { useViewContext } from '@/stores/view-context'

type SelectionToolbarProps = {
  containerRef: React.RefObject<HTMLElement | null>
}

type ToolbarPosition = {
  top: number
  left: number
}

export function SelectionToolbar({ containerRef }: SelectionToolbarProps) {
  const { push } = useSelectionQueue()
  const [position, setPosition] = useState<ToolbarPosition | null>(null)

  const updatePosition = useCallback(() => {
    const selection = window.getSelection()
    const container = containerRef.current

    if (!selection || selection.isCollapsed || !container) {
      setPosition(null)
      return
    }

    try {
      const range = selection.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) {
        setPosition(null)
        return
      }

      const text = selection.toString().trim()
      if (!text) {
        setPosition(null)
        return
      }

      const rect = range.getBoundingClientRect()
      setPosition({
        top: rect.top,
        left: rect.left + rect.width / 2,
      })
    } catch {
      setPosition(null)
    }
  }, [containerRef])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handleSelectionChange = () => {
      clearTimeout(timer)
      timer = setTimeout(updatePosition, 200)
    }

    document.addEventListener('selectionchange', handleSelectionChange)

    const container = containerRef.current
    container?.addEventListener('scroll', updatePosition, { passive: true })

    return () => {
      clearTimeout(timer)
      document.removeEventListener('selectionchange', handleSelectionChange)
      container?.removeEventListener('scroll', updatePosition)
    }
  }, [containerRef, updatePosition])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const handleSelect = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const context = collectSelectionContext(selection)
    if (context) {
      const { repo, path, pageNumber } = useViewContext.getState()
      push({
        ...context,
        repo: repo ?? undefined,
        path: path ?? undefined,
        pageNumber: pageNumber ?? undefined,
      })
    }

    window.getSelection()?.removeAllRanges()
  }

  if (!position) return null

  const toolbarHeight = 36
  const top = Math.max(4, position.top - toolbarHeight - 8)

  return createPortal(
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        top,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
      className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg px-1 py-1"
    >
      <button
        type="button"
        onClick={handleSelect}
        className="px-2.5 py-1 text-xs rounded-md hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
      >
        Quote
      </button>
    </div>,
    document.body,
  )
}
