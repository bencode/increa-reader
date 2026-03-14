import type p5 from 'p5'
import type { RendererMode } from '@/types/board'
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

const WEBGL_FUNCTIONS = [
  // 3D primitives
  'box', 'sphere', 'cylinder', 'cone', 'torus', 'plane',
  // 3D transforms
  'rotateX', 'rotateY', 'rotateZ',
  // Lighting
  'ambientLight', 'directionalLight', 'pointLight',
  'specularMaterial', 'ambientMaterial', 'normalMaterial', 'emissiveMaterial', 'shininess',
  // Camera
  'camera', 'perspective', 'ortho',
  // Texture
  'texture', 'textureMode', 'textureWrap',
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

// --- Compilation cache ---

type CompiledFn = { fn: (ctx: Record<string, unknown>) => void; error?: string }

const compilationCache = new Map<string, CompiledFn>()

export function compileInstruction(code: string): CompiledFn {
  const cached = compilationCache.get(code)
  if (cached) return cached

  let result: CompiledFn
  try {
    // Using with($ctx) so instruction code can access p5 functions and user vars directly
    const compiled = new Function('$ctx', `with($ctx) { ${code} }`)
    result = { fn: compiled as (ctx: Record<string, unknown>) => void }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    result = { fn: () => {}, error: msg }
  }
  compilationCache.set(code, result)
  return result
}

// --- Context building ---

export function buildContext(p: p5, vars?: Record<string, unknown>, renderer?: RendererMode): Record<string, unknown> {
  const ctx: Record<string, unknown> = { ...(vars ?? {}) }
  const functions = renderer === 'webgl'
    ? [...DRAWING_FUNCTIONS, ...WEBGL_FUNCTIONS]
    : DRAWING_FUNCTIONS
  for (const fn of functions) {
    const val = (p as unknown as Record<string, unknown>)[fn]
    ctx[fn] = typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(p) : val
  }
  ctx.math = createMathFunction(p)
  ctx.frameCount = 0
  return ctx
}

// --- Execution ---

export function executeInstruction(ctx: Record<string, unknown>, code: string): string | null {
  const { fn, error } = compileInstruction(code)
  if (error) return `Compile error: ${error}`
  try {
    fn(ctx)
    return null
  } catch (e) {
    return `Runtime error: ${e instanceof Error ? e.message : String(e)}`
  }
}

export function clearMathCache() {
  mathImageCache.clear()
}
