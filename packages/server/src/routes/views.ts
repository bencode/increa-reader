import { createRoute, z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import type { WorkspaceConfig, RepoItem } from '../types'

const ViewResponseSchema = z.object({
  type: z.enum(['text', 'binary']),
  content: z.string(),
  filename: z.string(),
})

const getContentViewRoute = createRoute({
  method: 'get',
  path: '/api/views/{repo}/{path}',
  parameters: [
    {
      name: 'repo',
      in: 'path',
      required: true,
      schema: z.string(),
    },
    {
      name: 'path',
      in: 'path',
      required: true,
      schema: z.string(),
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ViewResponseSchema,
        },
      },
      description: 'Get file content',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'File not found',
    },
  },
})

async function isTextFile(buffer: Buffer): Promise<boolean> {
  const fileType = await fileTypeFromBuffer(buffer)
  if (fileType) {
    const textMimeTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/x-yaml',
      'application/yaml',
    ]
    return textMimeTypes.some(mime => fileType.mime.startsWith(mime))
  }

  const text = buffer.toString('utf8', 0, Math.min(512, buffer.length))
  const controlChars = /[^\x20-\x7E\n\r\t\u0000-\u001F\u007F-\u009F]/g
  const nonTextChars = (text.match(controlChars) || []).length
  return nonTextChars / text.length < 0.3
}

export function registerViewsRoutes(app: OpenAPIHono) {
  app.openapi(getContentViewRoute, async c => {
    const { repo, path } = c.req.param()

    const workspace = c.get('workspace')
    const repoConfig = workspace.repos.find(r => r.name === repo)
    if (!repoConfig) {
      return c.json({ error: `Repository '${repo}' not found` }, 404)
    }

    const filePath = join(repoConfig.root, path)

    try {
      await stat(filePath)
      const buffer = await readFile(filePath)

      const isText = await isTextFile(buffer)

      if (isText) {
        return c.json({
          type: 'text',
          content: buffer.toString('utf8'),
          filename: path.split('/').pop() || '',
        })
      } else {
        return c.json({
          type: 'binary',
          content: '[Binary file - preview not available]',
          filename: path.split('/').pop() || '',
        })
      }
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error)
      return c.json({ error: 'File not found or cannot be read' }, 404)
    }
  })
}