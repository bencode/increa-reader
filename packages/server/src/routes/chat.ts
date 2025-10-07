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
                permissionMode: z
                  .enum(['default', 'acceptEdits', 'bypassPermissions', 'plan'])
                  .optional(),
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
${workspace.repos
  .filter(r => r.name !== repo)
  .map(r => `- ${r.name}: ${r.root}`)
  .join('\n')}
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
      executable: process.env.BUN_PATH,
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
      env: {
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_API_KEY: '',
      },
    }

    return streamSSE(c, async stream => {
      try {
        console.log('🚀 [Chat] Starting query...')
        console.log('   Prompt:', prompt.slice(0, 50) + '...')
        console.log('   Session ID:', sessionId || '(new)')
        console.log('   Repo:', repo || 'all')
        console.log('   CWD:', cwd)

        let messageCount = 0

        for await (const msg of query({ prompt, options: queryOptions })) {
          messageCount++
          console.log(`📨 [Chat] Message #${messageCount}: type=${msg.type}`)

          // 详细日志
          if (msg.type === 'system' && msg.subtype === 'init') {
            console.log('   ✓ System initialized, session_id:', msg.session_id)
          }

          if (msg.type === 'assistant') {
            console.log('   ✓ Assistant message received')
          }

          if (msg.type === 'stream_event') {
            console.log('   ✓ Stream event:', msg.event?.type)
          }

          if (msg.type === 'result') {
            console.log('   ✓ Result:', msg.subtype)
            console.log('   Duration:', msg.duration_ms + 'ms')
            console.log('   Tokens:', `in=${msg.usage?.input_tokens} out=${msg.usage?.output_tokens}`)
          }

          await stream.writeSSE({
            data: JSON.stringify(msg),
          })
        }

        console.log('✅ [Chat] Query completed, total messages:', messageCount)

      } catch (error) {
        console.error('❌ [Chat] Error occurred:')
        console.error('   Message:', error instanceof Error ? error.message : 'Unknown error')
        console.error('   Stack:', error instanceof Error ? error.stack : '')

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
