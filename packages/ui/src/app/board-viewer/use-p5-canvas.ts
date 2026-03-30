import p5 from 'p5'
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { setErrors } from '@/stores/board-store'
import type { BoardAnimation, RendererMode } from '@/types/board'
import { buildContext, executeInstruction } from './p5-executor'

type CanvasOptions = {
  containerRef: RefObject<HTMLDivElement>
  tabKey: string
  position: { x: number; y: number }
  scale: number
  background: [number, number, number]
  instructions: string[]
  animation?: BoardAnimation
  controlValues: Record<string, number>
  renderer?: RendererMode
}

type DrawRefs = {
  positionRef: React.RefObject<{ x: number; y: number }>
  scaleRef: React.RefObject<number>
  backgroundRef: React.RefObject<[number, number, number]>
  instructionsRef: React.RefObject<string[]>
  ctxRef: React.RefObject<Record<string, unknown> | null>
  tabKeyRef: React.RefObject<string>
  rendererRef: React.RefObject<RendererMode | undefined>
}

function runInstructions(p: p5, refs: DrawRefs) {
  const bg = refs.backgroundRef.current
  p.background(bg[0], bg[1], bg[2])

  const pos = refs.positionRef.current
  const s = refs.scaleRef.current
  const isWebGL = refs.rendererRef.current === 'webgl'

  if (isWebGL) {
    p.translate(pos.x, pos.y, 0)
    p.scale(s)
  } else {
    p.translate(pos.x + p.width / 2, pos.y + p.height / 2)
    p.scale(s)
    p.translate(-p.width / 2, -p.height / 2)
  }

  const items = refs.instructionsRef.current
  const ctx = refs.ctxRef.current
  if (!ctx) return

  const errors: Record<number, string> = {}
  for (let i = 0; i < items.length; i++) {
    p.push()
    const err = executeInstruction(ctx, items[i])
    if (err) errors[i] = err
    p.pop()
  }

  ctx.frameCount = (ctx.frameCount as number) + 1

  const tabKey = refs.tabKeyRef.current
  if (Object.keys(errors).length > 0) {
    setErrors(tabKey, errors)
  }
}

function createP5Instance(
  container: HTMLDivElement,
  refs: DrawRefs,
  animation: BoardAnimation | undefined,
  setupReadyRef: React.RefObject<boolean>,
  renderer?: RendererMode,
) {
  return new p5((p: p5) => {
    p.setup = () => {
      if (renderer === 'webgl') {
        p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL)
        p.setAttributes('preserveDrawingBuffer', true)
      } else {
        p.createCanvas(container.clientWidth, container.clientHeight)
      }
      refs.ctxRef.current = buildContext(p, animation?.vars, renderer)
      if (animation?.loop) {
        p.frameRate(animation.fps ?? 60)
      } else {
        p.noLoop()
      }
      setupReadyRef.current = true
    }
    p.draw = () => runInstructions(p, refs)
  }, container)
}

// External store for loop state — avoids setState-in-effect issues
function createLoopStore(initial: boolean) {
  let looping = initial
  const listeners = new Set<() => void>()
  const subscribe = (fn: () => void) => {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }
  const get = () => looping
  const set = (v: boolean) => {
    looping = v
    listeners.forEach(fn => {
      fn()
    })
  }
  return { subscribe, get, set }
}

export function useP5Canvas({
  containerRef,
  tabKey,
  position,
  scale,
  background,
  instructions,
  animation,
  controlValues,
  renderer,
}: CanvasOptions) {
  const p5Ref = useRef<p5 | null>(null)

  // Stable store — subscribe/get never change identity, created once
  const loopStore = useMemo(() => createLoopStore(animation?.loop ?? false), [])
  const isLooping = useSyncExternalStore(loopStore.subscribe, loopStore.get)

  const positionRef = useRef(position)
  const scaleRef = useRef(scale)
  const backgroundRef = useRef(background)
  const instructionsRef = useRef(instructions)
  const tabKeyRef = useRef(tabKey)
  const ctxRef = useRef<Record<string, unknown> | null>(null)
  const rendererRef = useRef(renderer)
  const setupReadyRef = useRef(false)
  const animationRef = useRef(animation)
  const controlValuesRef = useRef(controlValues)
  controlValuesRef.current = controlValues

  // Rebuild context when animation config changes
  useEffect(() => {
    const prev = animationRef.current
    animationRef.current = animation
    const p = p5Ref.current
    if (!p || !setupReadyRef.current) return

    ctxRef.current = buildContext(p, animation?.vars, rendererRef.current)
    for (const [key, value] of Object.entries(controlValuesRef.current)) {
      ctxRef.current[key] = value
    }

    if (animation?.loop) {
      p.frameRate(animation.fps ?? 60)
      p.loop()
      loopStore.set(true)
    } else {
      p.noLoop()
      loopStore.set(false)
      if (prev?.loop) {
        p.redraw()
      }
    }
  }, [animation, loopStore])

  // Sync control values into context without rebuilding
  useEffect(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    for (const [key, value] of Object.entries(controlValues)) {
      ctx[key] = value
    }
    if (!animationRef.current?.loop) {
      p5Ref.current?.redraw()
    }
  }, [controlValues])

  // Sync refs and trigger redraw for static mode
  useEffect(() => {
    positionRef.current = position
    scaleRef.current = scale
    backgroundRef.current = background
    instructionsRef.current = instructions
    tabKeyRef.current = tabKey

    if (!animationRef.current?.loop) {
      p5Ref.current?.redraw()
    }
  }, [position, scale, background, instructions, tabKey])

  // Create p5 instance (mount only — animation config is applied via separate effect)
  useEffect(() => {
    const container = containerRef.current!

    if (!p5Ref.current) {
      const refs: DrawRefs = {
        positionRef,
        scaleRef,
        backgroundRef,
        instructionsRef,
        ctxRef,
        tabKeyRef,
        rendererRef,
      }
      p5Ref.current = createP5Instance(container, refs, animation, setupReadyRef, renderer)
    }

    const observer = new ResizeObserver(() => {
      if (p5Ref.current) {
        p5Ref.current.resizeCanvas(container.clientWidth, container.clientHeight)
        if (!animationRef.current?.loop) {
          p5Ref.current.redraw()
        }
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

  // Rebuild p5 instance when renderer mode changes
  useEffect(() => {
    if (rendererRef.current === renderer) return
    rendererRef.current = renderer
    const container = containerRef.current
    if (!container) return

    p5Ref.current?.remove()
    setupReadyRef.current = false
    const refs: DrawRefs = {
      positionRef,
      scaleRef,
      backgroundRef,
      instructionsRef,
      ctxRef,
      tabKeyRef,
      rendererRef,
    }
    p5Ref.current = createP5Instance(container, refs, animationRef.current, setupReadyRef, renderer)
  }, [renderer])

  const toggleLoop = useCallback(() => {
    const p = p5Ref.current
    if (!p) return
    if (loopStore.get()) {
      p.noLoop()
      loopStore.set(false)
    } else {
      p.loop()
      loopStore.set(true)
    }
  }, [loopStore])

  return { isLooping, toggleLoop }
}
