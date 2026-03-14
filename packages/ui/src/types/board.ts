export type RangeControlDef = {
  type: 'range'
  min: number
  max: number
  step?: number
  default?: number
}

export type NumberControlDef = {
  type: 'number'
  min?: number
  max?: number
  default?: number
}

export type ControlDef = RangeControlDef | NumberControlDef

export type BoardAnimation = {
  loop: boolean
  fps?: number
  vars?: Record<string, unknown>
  controls?: Record<string, ControlDef>
}

export type RendererMode = '2d' | 'webgl'

export type BoardFile = {
  version: number
  canvas: { background: [number, number, number] }
  instructions: string[]
  animation?: BoardAnimation
  renderer?: RendererMode
}
