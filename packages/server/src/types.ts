export type Workspace = {
  title: string
  repos: RepoItem[]
  excludes: string[]
}

export type RepoItem = {
  name: string
  root: string
}

export type TreeNode = {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: TreeNode[]
}

export type RepoResource = {
  name: string
  files: TreeNode[]
}

export type WorkspaceConfig = {
  title: string
  repos: RepoItem[]
  excludes: string[]
}