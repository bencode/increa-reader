/**
 * Frontend tool handlers - execute tools requested by LLM
 */

import type { SelectionContext } from '@/contexts/selection-context'
import { shiftContext } from '@/contexts/selection-context'
import { useViewContext } from '@/stores/view-context'

export type ToolContext = {
  visibleElements: Set<HTMLElement>
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
  args: Record<string, unknown>,
): Promise<SelectionContext | SelectionContext[] | string> => {
  const number = typeof args.number === 'number' ? args.number : 1
  const results: SelectionContext[] = []

  for (let i = 0; i < number; i++) {
    const ctx = shiftContext()
    if (!ctx) break
    results.push(ctx)
  }

  if (results.length === 0) return 'No selection context available'
  return number === 1 ? results[0] : results
}

const getCurrentPage = async (): Promise<number> => {
  const context = useViewContext.getState()

  if (!context.pageNumber) {
    throw new Error('Not viewing a PDF file or page number not available')
  }

  return context.pageNumber
}

const toolHandlers: Record<string, ToolHandler> = {
  get_visible_content: ctx => getVisibleContent(ctx),
  get_selection: (_ctx, args) => getSelection(args),
  get_current_page: () => getCurrentPage(),
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
