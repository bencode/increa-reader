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

type RepoResource = {
  name: string
  root: string
  files: TreeNode[]
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

export async function fetchWorkspaceTree(): Promise<RepoResource[]> {
  const response = await fetch('/api/workspace/tree')
  const data = await response.json()
  return data.data
}

export async function fetchPreview(repo: string, path: string): Promise<PreviewResponse> {
  const params = new URLSearchParams({ repo, path })
  const response = await fetch(`/api/preview?${params}`)
  const data = await response.json()
  return data
}

export type { TreeNode, RepoInfo, RepoTreeData }
