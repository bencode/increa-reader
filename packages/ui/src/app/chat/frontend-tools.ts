/**
 * Frontend tool handlers - execute tools requested by LLM
 */

import { useViewContext } from '@/stores/view-context'

type ToolResult = { result?: unknown; error?: string }

/**
 * Get the content currently visible in user's viewport
 */
const getVisibleContent = async (): Promise<string> => {
  // Get main content area
  const contentElement = document.querySelector('[data-content-viewer]')
  if (contentElement) {
    return contentElement.textContent || ''
  }

  return 'No visible content available'
}

/**
 * Get user's current text selection
 */
const getSelection = async (): Promise<string> => {
  const selection = window.getSelection()
  return selection?.toString() || ''
}

/**
 * Get current PDF page number
 */
const getCurrentPage = async (): Promise<number> => {
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
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> => {
  try {
    // Strip MCP prefix if present (e.g., "mcp__frontend__get_visible_content" -> "get_visible_content")
    const toolName = name.replace(/^mcp__frontend__/, '')

    let result: unknown

    switch (toolName) {
      case 'get_visible_content':
        result = await getVisibleContent()
        break

      case 'get_selection':
        result = await getSelection()
        break

      case 'get_current_page':
        result = await getCurrentPage()
        break

      default:
        return { error: `Unknown tool: ${name}` }
    }

    return { result }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
