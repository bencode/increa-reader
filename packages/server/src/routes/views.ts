import { createRoute, z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import type { WorkspaceConfig, RepoItem } from '../types'

const ViewResponseSchema = z.object({
  type: z.enum(['text', 'binary']),
  content: z.string(),
  filename: z.string(),
})

const PreviewResponseSchema = z.object({
  type: z.string(),
}).passthrough()

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

const getPreviewRoute = createRoute({
  method: 'get',
  path: '/api/preview/{repo}/{path}',
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
          schema: PreviewResponseSchema,
        },
      },
      description: 'Get file preview',
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

async function isFileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

const SUPPORTED_LANGUAGES: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.fish': 'fish',
  '.ps1': 'powershell',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.sql': 'sql',
  '.vue': 'vue',
  '.svelte': 'svelte',
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']

function detectFileType(filename: string) {
  const ext = extname(filename).toLowerCase()

  if (ext === '.md' || ext === '.markdown') {
    return { type: 'markdown' }
  }

  if (IMAGE_EXTENSIONS.includes(ext)) {
    return { type: 'image' }
  }

  const lang = SUPPORTED_LANGUAGES[ext]
  if (lang) {
    return { type: 'code', lang }
  }

  return { type: 'unknown' }
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

    if (!(await isFileExists(filePath))) {
      return c.json({ error: 'File not found or cannot be read' }, 404)
    }

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
  })

  app.openapi(getPreviewRoute, async c => {
    const { repo, path } = c.req.param()

    const workspace = c.get('workspace')
    const repoConfig = workspace.repos.find(r => r.name === repo)
    if (!repoConfig) {
      return c.json({ error: `Repository '${repo}' not found` }, 404)
    }

    const filePath = join(repoConfig.root, path)

    if (!(await isFileExists(filePath))) {
      return c.json({ error: 'File not found or cannot be read' }, 404)
    }

    const fileInfo = detectFileType(path)

    if (fileInfo.type === 'image') {
      return c.json({
        type: 'image',
        path,
      })
    }

    if (fileInfo.type === 'markdown' || fileInfo.type === 'code') {
      const content = await readFile(filePath, 'utf8')

      if (fileInfo.type === 'markdown') {
        return c.json({
          type: 'markdown',
          body: content,
        })
      } else {
        return c.json({
          type: 'code',
          lang: fileInfo.lang,
          body: content,
        })
      }
    }

    return c.json({
      type: 'unknown',
      path,
    })
  })
}