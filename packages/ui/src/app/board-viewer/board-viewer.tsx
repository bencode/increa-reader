import { useEffect } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBoardStore } from '@/stores/board-store'
import type { BoardFile } from '@/types/board'
import { useP5Canvas } from './use-p5-canvas'
import { useCanvasNavigation } from './use-canvas-navigation'

type BoardViewerProps = {
  repo?: string
  filePath?: string
  data?: BoardFile
}

const DEFAULT_BACKGROUND: [number, number, number] = [255, 255, 255]
const EMPTY: string[] = []

export function BoardViewer({ repo, filePath, data }: BoardViewerProps) {
  const tabKey = repo && filePath ? `${repo}/${filePath}` : 'default'
  const instructions = useBoardStore(s => s.tabs[tabKey] ?? EMPTY)
  const background = data?.canvas?.background ?? DEFAULT_BACKGROUND
  const { position, scale, isDragging, containerRef, reset, zoomIn, zoomOut, handlers } = useCanvasNavigation()
  useP5Canvas({ containerRef, position, scale, background, instructions })

  useEffect(() => {
    useBoardStore.setState({ activeTab: tabKey })
    return () => {
      if (useBoardStore.getState().activeTab === tabKey) {
        useBoardStore.setState({ activeTab: null })
      }
    }
  }, [tabKey])

  useEffect(() => {
    if (data?.instructions) {
      useBoardStore.setState(s => ({
        tabs: { ...s.tabs, [tabKey]: data.instructions },
      }))
    }
  }, [data, tabKey])

  const clear = () => {
    useBoardStore.setState(s => ({
      tabs: { ...s.tabs, [tabKey]: [] },
    }))
  }

  const handleSave = async () => {
    const boardData: BoardFile = {
      version: 1,
      canvas: { background },
      instructions,
    }

    if (repo && filePath) {
      const res = await fetch(`/api/board/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, path: filePath, data: boardData }),
      })
      if (!res.ok) {
        console.error('Failed to save board:', res.status, await res.text())
      }
    } else {
      const blob = new Blob([JSON.stringify(boardData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'canvas.board'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-background/80 backdrop-blur-sm rounded-md p-2 shadow-md">
        <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={reset} title="Reset view">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={clear} title="Clear canvas">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleSave} title="Save board">
          <Save className="h-4 w-4" />
        </Button>
        <div className="flex items-center px-2 text-sm text-muted-foreground">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        {...handlers}
      />
    </div>
  )
}
