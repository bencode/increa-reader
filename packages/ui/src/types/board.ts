export type BoardFile = {
  version: number
  canvas: { background: [number, number, number] }
  instructions: string[]
}
