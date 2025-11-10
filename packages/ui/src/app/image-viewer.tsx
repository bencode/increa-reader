import { useState, useRef, useCallback, type MouseEvent, type WheelEvent } from 'react'
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ImageViewerProps = {
  src: string
  alt: string
}

export function ImageViewer({ src, alt }: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setScale(prev => Math.max(0.1, Math.min(10, prev * delta)))
    },
    []
  )

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    },
    [position]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, dragStart]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(10, prev * 1.2))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(0.1, prev / 1.2))
  }, [])

  const reset = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const img = container.querySelector('img')
    if (!img) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const imgWidth = img.naturalWidth
    const imgHeight = img.naturalHeight

    const scaleX = containerWidth / imgWidth
    const scaleY = containerHeight / imgHeight
    const newScale = Math.min(scaleX, scaleY, 1) * 0.9

    setScale(newScale)
    setPosition({ x: 0, y: 0 })
  }, [])

  return (
    <div className="relative h-full flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-background/80 backdrop-blur-sm rounded-md p-2 shadow-md">
        <Button variant="ghost" size="icon" onClick={zoomIn} title="放大 (滚轮向上)">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={zoomOut} title="缩小 (滚轮向下)">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={fitToScreen} title="适应屏幕">
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={reset} title="重置">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="flex items-center px-2 text-sm text-muted-foreground">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <img
          src={src}
          alt={alt}
          className="select-none pointer-events-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}
