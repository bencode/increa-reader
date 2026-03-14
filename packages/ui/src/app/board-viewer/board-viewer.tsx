import { useEffect, useMemo, useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Trash2, Save, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBoardStore, getTab } from '@/stores/board-store'
import type { BoardFile } from '@/types/board'
import { useP5Canvas } from './use-p5-canvas'
import { useCanvasNavigation } from './use-canvas-navigation'
import { ControlsPanel } from './controls-panel'

type BoardViewerProps = {
  repo?: string
  filePath?: string
  data?: BoardFile
}

const DEFAULT_BACKGROUND: [number, number, number] = [255, 255, 255]
const EMPTY: string[] = []

export function BoardViewer({ repo, filePath, data }: BoardViewerProps) {
  const tabKey = repo && filePath ? `${repo}/${filePath}` : 'default'
  const tab = useBoardStore(s => s.tabs[tabKey])
  const instructions = tab?.instructions ?? EMPTY
  const animation = tab?.animation
  const renderer = tab?.renderer
  const background = data?.canvas?.background ?? DEFAULT_BACKGROUND
  const [controlValues, setControlValues] = useState<Record<string, number>>({})

  const controlsKey = useMemo(
    () => animation?.controls ? JSON.stringify(animation.controls) : '',
    [animation?.controls],
  )

  useEffect(() => {
    if (!animation?.controls) {
      setControlValues({})
      return
    }
    const initial: Record<string, number> = {}
    for (const [name, def] of Object.entries(animation.controls)) {
      initial[name] = def.default ?? (def.type === 'range' ? def.min : 0)
    }
    setControlValues(initial)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsKey])

  const { position, scale, isDragging, containerRef, reset, zoomIn, zoomOut, handlers } = useCanvasNavigation()
  const { isLooping, toggleLoop } = useP5Canvas({
    containerRef, tabKey, position, scale, background, instructions, animation, controlValues, renderer,
  })

  useEffect(() => {
    useBoardStore.setState({ activeTab: tabKey })
    return () => {
      if (useBoardStore.getState().activeTab === tabKey) {
        useBoardStore.setState({ activeTab: null })
      }
    }
  }, [tabKey])

  useEffect(() => {
    if (!data) return
    const s = useBoardStore.getState()
    const existing = getTab(s, tabKey)
    useBoardStore.setState({
      tabs: {
        ...s.tabs,
        [tabKey]: {
          ...existing,
          instructions: data.instructions,
          ...(data.animation ? { animation: data.animation } : {}),
          ...(data.renderer ? { renderer: data.renderer } : {}),
        },
      },
    })
  }, [data, tabKey])

  const clear = () => {
    const s = useBoardStore.getState()
    useBoardStore.setState({
      tabs: { ...s.tabs, [tabKey]: { instructions: [], errors: undefined } },
    })
  }

  const handleSave = async () => {
    const boardData: BoardFile = {
      version: 1,
      canvas: { background },
      instructions,
      ...(animation ? { animation } : {}),
      ...(renderer ? { renderer } : {}),
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
        {animation?.loop && (
          <Button variant="ghost" size="icon" onClick={toggleLoop} title={isLooping ? 'Pause' : 'Play'}>
            {isLooping ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
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

      {animation?.controls && Object.keys(animation.controls).length > 0 && (
        <ControlsPanel
          controls={animation.controls}
          values={controlValues}
          onChange={setControlValues}
        />
      )}
    </div>
  )
}
