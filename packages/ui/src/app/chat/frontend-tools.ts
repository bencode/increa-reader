/**
 * Frontend tool handlers - execute tools requested by LLM
 */

import type { SelectionContext } from '@/contexts/selection-context'
import { uploadImage } from '@/lib/upload'
import { useViewContext } from '@/stores/view-context'
import type { BoardAnimation } from '@/types/board'
import { coerce } from '@/lib/coerce'
import { compileInstruction } from '../board-viewer/p5-executor'

export type ToolContext = {
  visibleElements: Set<HTMLElement>
  getSelections: (max?: number) => SelectionContext[]
  boardAppend: (tabKey: string, code: string) => number
  boardClear: (tabKey: string) => void
  getBoardInstructions: (tabKey: string) => string[]
  getBoardErrors: (tabKey: string) => Record<number, string> | undefined
  getActiveTab: () => string | null
  getCanvasElement: () => HTMLCanvasElement | null
  setAnimation: (tabKey: string, config: BoardAnimation) => void
}

type ToolResult = { result?: unknown; error?: string }

type ToolHandler = (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>

const getVisibleContent = async (ctx: ToolContext): Promise<string> => {
  const { visibleElements } = ctx

  if (visibleElements.size === 0) {
    return 'No visible content'
  }

  return Array.from(visibleElements)
    .map(el => el.textContent?.trim())
    .filter(Boolean)
    .join('\n\n')
}

const getSelection = async (
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<SelectionContext | SelectionContext[] | string> => {
  const max = typeof args.number === 'number' ? args.number : undefined
  const results = ctx.getSelections(max)
  if (results.length === 0) return 'No selection context available'
  return results.length === 1 ? results[0] : results
}

const getCurrentPage = async (): Promise<number> => {
  const context = useViewContext.getState()

  if (!context.pageNumber) {
    throw new Error('Not viewing a PDF file or page number not available')
  }

  return context.pageNumber
}

const refreshView = async (): Promise<string> => {
  useViewContext.getState().requestRefresh()
  return 'View refreshed'
}

const canvasDraw = async (ctx: ToolContext, args: Record<string, unknown>): Promise<string> => {
  const code = args.code as string
  const tabKey = ctx.getActiveTab()
  if (!tabKey) {
    throw new Error('No .board file is open. Ask the user to open or create a .board file first.')
  }
  // Compile-time validation — fail fast so LLM can retry
  const { error } = compileInstruction(code)
  if (error) {
    throw new Error(`Compile error: ${error}\nCode: ${code}`)
  }
  const total = ctx.boardAppend(tabKey, code)
  return `Drawing instruction added (total: ${total})`
}

const canvasClear = async (ctx: ToolContext): Promise<string> => {
  const tabKey = ctx.getActiveTab()
  if (!tabKey) {
    throw new Error('No .board file is open. Ask the user to open or create a .board file first.')
  }
  ctx.boardClear(tabKey)
  return 'Canvas cleared'
}

const canvasGetInstructions = async (ctx: ToolContext): Promise<string> => {
  const tabKey = ctx.getActiveTab()
  if (!tabKey) {
    throw new Error('No .board file is open. Ask the user to open or create a .board file first.')
  }
  const instructions = ctx.getBoardInstructions(tabKey)
  if (instructions.length === 0) return 'No drawing instructions on the canvas.'

  const errors = ctx.getBoardErrors(tabKey)
  const lines = instructions.map((code, i) => {
    const status = errors?.[i] ? `\u2717 ${errors[i]}` : '\u2713'
    return `[${i}] ${JSON.stringify(code)}  ${status}`
  })
  return lines.join('\n')
}

const canvasSnapshot = async (ctx: ToolContext): Promise<{ absolutePath: string; filename: string }> => {
  const canvas = ctx.getCanvasElement()
  if (!canvas) {
    throw new Error('No canvas element found. Make sure a board is open with drawings.')
  }

  const tabKey = ctx.getActiveTab()
  const errors = tabKey ? ctx.getBoardErrors(tabKey) : undefined
  const errorCount = errors ? Object.keys(errors).length : 0

  const dataUrl = canvas.toDataURL('image/png')
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const result = await uploadImage(blob)

  if (errorCount > 0) {
    return { ...result, errorSummary: `${errorCount} instruction(s) have runtime errors` } as { absolutePath: string; filename: string }
  }
  return result
}

const canvasSetup = async (ctx: ToolContext, args: Record<string, unknown>): Promise<string> => {
  const tabKey = ctx.getActiveTab()
  if (!tabKey) {
    throw new Error('No .board file is open. Ask the user to open or create a .board file first.')
  }
  const loop = coerce('boolean', args.loop ?? false) as boolean
  const fps = coerce('integer', args.fps ?? 60) as number
  const vars = coerce('object', args.vars ?? {}) as Record<string, unknown>
  ctx.setAnimation(tabKey, { loop, fps, vars })
  const varNames = Object.keys(vars)
  return `Canvas setup: loop=${loop}, fps=${fps}${varNames.length > 0 ? `, vars=${varNames.join(', ')}` : ''}`
}

const toolHandlers: Record<string, ToolHandler> = {
  get_visible_content: (ctx) => getVisibleContent(ctx),
  get_selection: (ctx, args) => getSelection(ctx, args),
  get_current_page: () => getCurrentPage(),
  refresh_view: () => refreshView(),
  canvas_draw: (ctx, args) => canvasDraw(ctx, args),
  canvas_clear: (ctx) => canvasClear(ctx),
  canvas_get_instructions: (ctx) => canvasGetInstructions(ctx),
  canvas_snapshot: (ctx) => canvasSnapshot(ctx),
  canvas_setup: (ctx, args) => canvasSetup(ctx, args),
}

/**
 * Execute a frontend tool requested by the LLM
 */
export const executeFrontendTool = async (
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> => {
  try {
    const toolName = name.replace(/^mcp__frontend__/, '')
    const handler = toolHandlers[toolName]
    if (!handler) return { error: `Unknown tool: ${name}` }
    const result = await handler(ctx, args)
    return { result }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
