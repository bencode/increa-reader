import { useEffect, useRef, type RefObject } from 'react'
import p5 from 'p5'
import { executeInstruction } from './p5-executor'

type CanvasOptions = {
  containerRef: RefObject<HTMLDivElement>
  position: { x: number; y: number }
  scale: number
  background: [number, number, number]
  instructions: string[]
}

type DrawRefs = {
  positionRef: React.RefObject<{ x: number; y: number }>
  scaleRef: React.RefObject<number>
  backgroundRef: React.RefObject<[number, number, number]>
  instructionsRef: React.RefObject<string[]>
}

function createP5Instance(container: HTMLDivElement, refs: DrawRefs) {
  const { positionRef, scaleRef, backgroundRef, instructionsRef } = refs

  return new p5((p: p5) => {
    p.setup = () => {
      p.createCanvas(container.clientWidth, container.clientHeight)
      p.noLoop()
    }

    p.draw = () => {
      const bg = backgroundRef.current
      p.background(bg[0], bg[1], bg[2])

      const pos = positionRef.current
      const s = scaleRef.current
      p.translate(pos.x + p.width / 2, pos.y + p.height / 2)
      p.scale(s)
      p.translate(-p.width / 2, -p.height / 2)

      const items = instructionsRef.current
      for (let i = 0; i < items.length; i++) {
        p.push()
        try {
          executeInstruction(p, items[i])
        } catch (err) {
          console.warn('[p5 draw] instruction error:', err)
        }
        p.pop()
      }
    }
  }, container)
}

export function useP5Canvas({ containerRef, position, scale, background, instructions }: CanvasOptions) {
  const p5Ref = useRef<p5 | null>(null)

  const positionRef = useRef(position)
  const scaleRef = useRef(scale)
  const backgroundRef = useRef(background)
  const instructionsRef = useRef(instructions)

  useEffect(() => {
    positionRef.current = position
    scaleRef.current = scale
    backgroundRef.current = background
    instructionsRef.current = instructions
    p5Ref.current?.redraw()
  }, [position, scale, background, instructions])

  useEffect(() => {
    const container = containerRef.current!

    if (!p5Ref.current) {
      p5Ref.current = createP5Instance(container, { positionRef, scaleRef, backgroundRef, instructionsRef })
    }

    const observer = new ResizeObserver(() => {
      if (p5Ref.current) {
        p5Ref.current.resizeCanvas(container.clientWidth, container.clientHeight)
        p5Ref.current.redraw()
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [containerRef])

}
