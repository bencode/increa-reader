import { streamSSE } from 'hono/streaming'
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi'
import { query } from '@anthropic-ai/claude-agent-sdk'

import type { WorkspaceConfig } from '../types'

const queryRoute = createRoute({
  method: 'post',
  path: '/api/chat/query',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            prompt: z.string().min(1),
            sessionId: z.string().optional(),
            repo: z.string().optional(),
            options: z
              .object({
                allowedTools: z.array(z.string()).optional(),
                permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).optional(),
                maxTurns: z.number().optional(),
              })
              .optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'SSE stream of SDK messages',
      content: {
        'text/event-stream': {
          schema: z.object({}),
        },
      },
    },
  },
})

export const registerChatRoutes = (app: OpenAPIHono) => {
  app.openapi(queryRoute, async c => {
    const { prompt, sessionId, repo, options = {} } = await c.req.json()
    const workspace = c.get('workspace') as WorkspaceConfig

    let cwd: string
    let systemPromptAppend: string

    if (repo && repo !== '~') {
      const targetRepo = workspace.repos.find(r => r.name === repo)
      if (!targetRepo) {
        return c.json({ error: `Repo not found: ${repo}` }, 404)
      }
      cwd = targetRepo.root
      systemPromptAppend = `
当前工作目录: ${repo} (${cwd})
你可以直接使用相对路径访问此仓库的文件。
如需访问其他仓库，请使用完整路径：
${workspace.repos.filter(r => r.name !== repo).map(r => `- ${r.name}: ${r.root}`).join('\n')}
      `.trim()
    } else {
      cwd = workspace.repos[0].root
      systemPromptAppend = `
你正在协助分析多个代码仓库：
${workspace.repos.map(r => `- ${r.name}: ${r.root}`).join('\n')}

请根据用户的问题，搜索相关仓库或询问用户具体需求。
      `.trim()
    }

    const queryOptions = {
      cwd,
      additionalDirectories: workspace.repos.map(r => r.root),
      allowedTools: options.allowedTools || ['Read', 'Grep', 'Glob'],
      permissionMode: options.permissionMode || 'bypassPermissions',
      includePartialMessages: true,
      resume: sessionId,
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append: systemPromptAppend,
      },
      maxTurns: options.maxTurns,
    }

    return streamSSE(c, async stream => {
      try {
        for await (const msg of query({ prompt, options: queryOptions })) {
          await stream.writeSSE({
            data: JSON.stringify(msg),
          })
        }
      } catch (error) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        })
      }
    })
  })
}
