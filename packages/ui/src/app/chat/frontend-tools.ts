/**
 * Frontend tool handlers - execute tools requested by LLM
 */

import { useViewContext } from '@/stores/view-context'

export type ToolContext = {
  visibleElements: Set<HTMLElement>
}

type ToolResult = { result?: unknown; error?: string }

/**
 * Get the content currently visible in user's viewport
 */
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

/**
 * Get user's current text selection
 */
const getSelection = async (_ctx: ToolContext): Promise<string> => {
  const selection = window.getSelection()
  return selection?.toString() || ''
}

/**
 * Get current PDF page number
 */
const getCurrentPage = async (_ctx: ToolContext): Promise<number> => {
  // Get page number from Zustand store
  const context = useViewContext.getState()

  if (!context.pageNumber) {
    throw new Error('Not viewing a PDF file or page number not available')
  }

  return context.pageNumber
}

/**
 * Execute a frontend tool requested by the LLM
 */
export const executeFrontendTool = async (
  ctx: ToolContext,
  name: string,
  _args: Record<string, unknown>,
): Promise<ToolResult> => {
  try {
    // Strip MCP prefix if present (e.g., "mcp__frontend__get_visible_content" -> "get_visible_content")
    const toolName = name.replace(/^mcp__frontend__/, '')

    let result: unknown

    switch (toolName) {
      case 'get_visible_content':
        result = await getVisibleContent(ctx)
        break

      case 'get_selection':
        result = await getSelection(ctx)
        break

      case 'get_current_page':
        result = await getCurrentPage(ctx)
        break

      default:
        return { error: `Unknown tool: ${name}` }
    }

    return { result }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
