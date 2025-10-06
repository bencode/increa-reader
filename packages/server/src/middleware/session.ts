import type { MiddlewareHandler } from 'hono'
import type { WorkspaceConfig, RepoItem } from '../types'

function parseReposFromEnv(): RepoItem[] {
  const repoPaths = process.env.INCREA_REPO
  if (!repoPaths) {
    return []
  }

  return repoPaths.split(':').map(path => {
    const pathParts = path.split('/')
    const repoName = pathParts[pathParts.length - 1] || 'repo'

    return {
      name: repoName,
      root: path.trim(),
    }
  }).filter(Boolean)
}

function createWorkspaceConfig(): WorkspaceConfig {
  const repos = parseReposFromEnv()

  return {
    title: repos.length > 0 ? `${repos.length} Repositories` : 'No Repositories',
    repos,
    excludes: ['node_modules/', '.*'],
  }
}

const workspaceConfig = createWorkspaceConfig()

export const sessionMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    c.set('workspace', workspaceConfig)
    await next()
  }
}