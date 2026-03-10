type TreeNode = {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: TreeNode[]
}

type RepoInfo = {
  name: string
  root: string
}

type RepoTreeData = {
  name: string
  files: TreeNode[]
}

type PreviewResponse =
  | { type: 'markdown'; body: string }
  | { type: 'code'; lang: string; body: string }
  | { type: 'image'; path: string }
  | { type: 'unsupported'; path: string }

export async function fetchRepos(): Promise<RepoInfo[]> {
  const response = await fetch('/api/workspace/repos')
  const data = await response.json()
  return data.data
}

export async function fetchRepoTree(repoName: string): Promise<RepoTreeData> {
  const response = await fetch(`/api/workspace/repos/${encodeURIComponent(repoName)}/tree`)
  const data = await response.json()
  return data.data
}

export async function fetchPreview(repo: string, path: string): Promise<PreviewResponse> {
  const params = new URLSearchParams({ repo, path })
  const response = await fetch(`/api/preview?${params}`)
  const data = await response.json()
  return data
}

export async function deleteFile(repo: string, path: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/files/${encodeURIComponent(repo)}/${path}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete file')
  }
  return response.json()
}

type RepoConfigInfo = {
  name: string
  root: string
  exists: boolean
}

export async function fetchConfigRepos(): Promise<RepoConfigInfo[]> {
  const response = await fetch('/api/config/repos')
  const data = await response.json()
  return data.data
}

export async function updateConfigRepos(paths: string[]): Promise<RepoConfigInfo[]> {
  const response = await fetch('/api/config/repos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repos: paths.map((path) => ({ path })) }),
  })
  const data = await response.json()
  return data.data
}

export type ApiSettings = {
  base_url: string | null
  api_key: string | null
  default_model: string | null
}

export async function fetchApiSettings(): Promise<ApiSettings> {
  const response = await fetch('/api/config/api-settings')
  return response.json()
}

export async function updateApiSettings(settings: Partial<ApiSettings>): Promise<ApiSettings> {
  const response = await fetch('/api/config/api-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return response.json()
}

export type { TreeNode, RepoInfo, RepoTreeData, RepoConfigInfo }
