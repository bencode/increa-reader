import { Copy, MessageSquare, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelectionQueue } from '@/contexts/selection-context'

type Rect = { x: number; y: number; w: number; h: number }

type RegionSelectProps = {
  repo: string
  filePath: string
  pageNum: number
  imgRef: React.RefObject<HTMLImageElement | null>
}

type ExtractResult = {
  text: string
  page_width: number
  page_height: number
}

async function extractRegionText(
  repo: string,
  path: string,
  page: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Promise<ExtractResult> {
  const params = new URLSearchParams({
    repo,
    path,
    page: String(page),
    x0: String(x0),
    y0: String(y0),
    x1: String(x1),
    y1: String(y1),
  })
  const res = await fetch(`/api/pdf/extract-region?${params}`)
  if (!res.ok) throw new Error('Failed to extract text')
  return res.json()
}

function toPDFCoords(rect: Rect, imgEl: HTMLImageElement, pageWidth: number, pageHeight: number) {
  const displayW = imgEl.clientWidth
  const displayH = imgEl.clientHeight
  const scaleX = pageWidth / displayW
  const scaleY = pageHeight / displayH
  return {
    x0: rect.x * scaleX,
    y0: rect.y * scaleY,
    x1: (rect.x + rect.w) * scaleX,
    y1: (rect.y + rect.h) * scaleY,
  }
}

type ResultPopupProps = {
  text: string
  rect: Rect
  repo: string
  filePath: string
  pageNum: number
  onClose: () => void
}

function ResultPopup({ text, rect, repo, filePath, pageNum, onClose }: ResultPopupProps) {
  const { push } = useSelectionQueue()
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    onClose()
  }

  const handleAskAI = () => {
    push({ text, before: '', after: '', repo, path: filePath, pageNumber: pageNum })
    onClose()
  }

  const top = rect.y + rect.h + 4
  const left = rect.x + rect.w / 2

  return (
    <div
      ref={popupRef}
      className="absolute z-20 w-72 bg-popover border border-border rounded-lg shadow-lg"
      style={{ top, left, transform: 'translateX(-50%)' }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground">Extracted Text</span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-accent text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-2 max-h-40 overflow-y-auto">
        <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border">
        <button
          type="button"
          onClick={handleAskAI}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          Quote
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md hover:bg-accent transition-colors"
        >
          <Copy className="w-3 h-3" />
          Copy
        </button>
      </div>
    </div>
  )
}

export function RegionSelect({ repo, filePath, pageNum, imgRef }: RegionSelectProps) {
  const [dragging, setDragging] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [result, setResult] = useState<{ text: string; rect: Rect } | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const el = e.currentTarget
    const bounds = el.getBoundingClientRect()
    return { x: e.clientX - bounds.left, y: e.clientY - bounds.top }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setResult(null)
      const pos = getRelativePos(e)
      startRef.current = pos
      setRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
      setDragging(true)
    },
    [getRelativePos],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !startRef.current) return
      const pos = getRelativePos(e)
      const start = startRef.current
      setRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y),
      })
    },
    [dragging, getRelativePos],
  )

  const handleMouseUp = useCallback(async () => {
    if (!dragging || !rect) return
    setDragging(false)
    startRef.current = null

    if (rect.w < 5 || rect.h < 5) {
      setRect(null)
      return
    }

    const img = imgRef.current
    if (!img) return

    try {
      // SVG natural dimensions match PDF page dimensions in points
      const pdfCoords = toPDFCoords(rect, img, img.naturalWidth, img.naturalHeight)
      const data = await extractRegionText(
        repo,
        filePath,
        pageNum,
        pdfCoords.x0,
        pdfCoords.y0,
        pdfCoords.x1,
        pdfCoords.y1,
      )

      if (data.text) {
        setResult({ text: data.text, rect })
      } else {
        setRect(null)
      }
    } catch {
      setRect(null)
    }
  }, [dragging, rect, imgRef, repo, filePath, pageNum])

  const handleClose = useCallback(() => {
    setResult(null)
    setRect(null)
  }, [])

  return (
    <div
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {rect && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/15 rounded-sm pointer-events-none"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
          }}
        />
      )}
      {result && (
        <ResultPopup
          text={result.text}
          rect={result.rect}
          repo={repo}
          filePath={filePath}
          pageNum={pageNum}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
