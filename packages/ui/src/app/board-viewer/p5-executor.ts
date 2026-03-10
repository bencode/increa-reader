import type p5 from 'p5'
import { renderMathToImage } from './math-renderer'

const DRAWING_FUNCTIONS = [
  // Color
  'background', 'fill', 'noFill', 'stroke', 'noStroke', 'strokeWeight',
  'color', 'lerpColor', 'red', 'green', 'blue', 'alpha',
  'colorMode',
  // Shape
  'rect', 'ellipse', 'circle', 'line', 'triangle', 'quad', 'arc', 'point',
  'bezier', 'curve', 'beginShape', 'vertex', 'endShape',
  // Text
  'text', 'textSize', 'textAlign', 'textFont', 'textWidth', 'textLeading',
  // Transform
  'push', 'pop', 'translate', 'rotate', 'scale',
  // Constants
  'width', 'height', 'PI', 'TWO_PI', 'HALF_PI',
  'CLOSE', 'CENTER', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'BASELINE',
  'CORNERS', 'CORNER', 'RADIUS',
  'RGB', 'HSB', 'HSL',
  // Math
  'random', 'noise', 'map', 'constrain', 'lerp',
  'cos', 'sin', 'atan2', 'sqrt', 'abs', 'floor', 'ceil', 'round', 'pow',
  'min', 'max', 'dist',
  // Image
  'image', 'loadImage',
] as const

const mathImageCache = new Map<string, p5.Image>()

function createMathFunction(p: p5) {
  return (latex: string, x: number, y: number, size = 24) => {
    const cacheKey = `${latex}:${size}`
    const cached = mathImageCache.get(cacheKey)
    if (cached) {
      p.image(cached, x, y)
      return
    }

    const dataUrl = renderMathToImage(latex, size)
    if (!dataUrl) return

    p.loadImage(dataUrl, (img: p5.Image) => {
      mathImageCache.set(cacheKey, img)
      p.image(img, x, y)
      p.redraw()
    })
  }
}

export function executeInstruction(p: p5, code: string) {
  const scope: Record<string, unknown> = {}

  for (const fn of DRAWING_FUNCTIONS) {
    const val = (p as unknown as Record<string, unknown>)[fn]
    scope[fn] = typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(p) : val
  }

  scope.math = createMathFunction(p)

  const keys = Object.keys(scope)
  const values = Object.values(scope)
  const fn = new Function(...keys, code)
  fn(...values)
}

export function clearMathCache() {
  mathImageCache.clear()
}
