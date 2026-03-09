/**
 * Frontend tool handlers - execute tools requested by LLM
 */

import type { SelectionContext } from '@/contexts/selection-context'
import { useViewContext } from '@/stores/view-context'

export type ToolContext = {
  visibleElements: Set<HTMLElement>
  getSelections: (max?: number) => SelectionContext[]
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

const toolHandlers: Record<string, ToolHandler> = {
  get_visible_content: ctx => getVisibleContent(ctx),
  get_selection: (ctx, args) => getSelection(ctx, args),
  get_current_page: () => getCurrentPage(),
  refresh_view: () => refreshView(),
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
