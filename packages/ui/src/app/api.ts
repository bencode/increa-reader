type TreeNode = {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: TreeNode[]
}

type RepoResource = {
  name: string
  root: string
  files: TreeNode[]
}

export async function fetchWorkspaceTree(): Promise<RepoResource[]> {
  const response = await fetch('/api/workspace/tree')
  const data = await response.json()
  return data.data
}
