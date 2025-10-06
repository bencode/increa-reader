import { createRoute, z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import micromatch from 'micromatch'
import type { WorkspaceConfig, RepoItem, TreeNode, RepoResource } from '../types'

const TreeNodeSchema = z
  .object({
    type: z.enum(['dir', 'file']),
    name: z.string(),
    path: z.string(),
    children: z.array(z.any()).optional(),
  })
  .openapi('TreeNode')

const RepoResourceSchema = z.object({
  name: z.string(),
  files: z.array(TreeNodeSchema),
})

async function buildTree(
  dirPath: string,
  rootPath: string,
  excludes: string[]
): Promise<TreeNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    const relativePath = relative(rootPath, fullPath)

    if (micromatch.isMatch(entry.name, excludes)) {
      continue
    }

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, rootPath, excludes)
      nodes.push({
        type: 'dir',
        name: entry.name,
        path: relativePath,
        children,
      })
    } else if (entry.isFile()) {
      nodes.push({
        type: 'file',
        name: entry.name,
        path: relativePath,
      })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'dir' ? -1 : 1
  })
}

const getWorkspaceTreeRoute = createRoute({
  method: 'get',
  path: '/api/workspace/tree',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(RepoResourceSchema),
          }),
        },
      },
      description: 'Get workspace file tree',
    },
  },
})

export function registerWorkspaceRoutes(app: OpenAPIHono) {
  app.openapi(getWorkspaceTreeRoute, async c => {
    const workspace = c.get('workspace')
    const { repos, excludes } = workspace
    const result: RepoResource[] = []

    for (const repo of repos) {
      const files = await buildTree(repo.root, repo.root, excludes)
      result.push({
        name: repo.name,
        files,
      })
    }

    return c.json({ data: result as z.infer<typeof RepoResourceSchema>[] })
  })
}
