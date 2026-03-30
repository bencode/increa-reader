import { type MouseEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'

type Position = { x: number; y: number }

export function useCanvasNavigation() {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<Position>({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: globalThis.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setScale(prev => Math.max(0.1, Math.min(10, prev * delta)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    },
    [position],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      })
    },
    [isDragging],
  )

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  const reset = useCallback(() => {
    setPosition({ x: 0, y: 0 })
    setScale(1)
  }, [])

  return {
    position,
    scale,
    isDragging,
    containerRef: containerRef as RefObject<HTMLDivElement>,
    reset,
    zoomIn: useCallback(() => setScale(s => Math.min(10, s * 1.2)), []),
    zoomOut: useCallback(() => setScale(s => Math.max(0.1, s / 1.2)), []),
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
    },
  }
}
