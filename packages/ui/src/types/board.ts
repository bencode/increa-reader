export type BoardAnimation = {
  loop: boolean
  fps?: number
  vars?: Record<string, unknown>
}

export type BoardFile = {
  version: number
  canvas: { background: [number, number, number] }
  instructions: string[]
  animation?: BoardAnimation
}
