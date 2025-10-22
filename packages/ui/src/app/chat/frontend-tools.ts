/**
 * Frontend tool handlers - execute tools requested by LLM
 */

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
 * Get PDF page context (page number, total pages, content)
 */
const getPageContext = async (): Promise<{
  pageNumber: number
  totalPages: number
  content: string
}> => {
  // TODO: Get from PDF viewer state via global store or data attributes
  const params = new URLSearchParams(window.location.search)
  const page = params.get('page')

  if (!page) {
    throw new Error('Not viewing a PDF file')
  }

  const pageElement = document.querySelector(`[data-page="${page}"]`)
  const content = pageElement?.textContent || ''

  return {
    pageNumber: Number.parseInt(page, 10),
    totalPages: 0, // TODO: Get from PDF viewer state
    content,
  }
}

/**
 * Execute a frontend tool requested by the LLM
 */
export const executeFrontendTool = async (
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> => {
  try {
    let result: unknown

    switch (name) {
      case 'get_visible_content':
        result = await getVisibleContent()
        break

      case 'get_selection':
        result = await getSelection()
        break

      case 'get_page_context':
        result = await getPageContext()
        break

      default:
        return { error: `Unknown tool: ${name}` }
    }

    return { result }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
