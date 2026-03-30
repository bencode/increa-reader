import type { TreeNode } from './api'

export type TreeFilterResult = {
  nodes: TreeNode[]
  forcedOpenPaths: Set<string>
  matchCount: number
}

const normalizeQuery = (query: string) => query.trim().toLowerCase()

const matchesNode = (repoName: string, nodePath: string, query: string) =>
  `${repoName}/${nodePath}`.toLowerCase().includes(query)

const collectDirectoryPaths = (nodes: TreeNode[], paths = new Set<string>()) => {
  for (const node of nodes) {
    if (node.type !== 'dir') continue
    paths.add(node.path)
    if (node.children) {
      collectDirectoryPaths(node.children, paths)
    }
  }
  return paths
}

const countMatchesInNode = (node: TreeNode, repoName: string, query: string): number => {
  const selfMatches = matchesNode(repoName, node.path, query) ? 1 : 0
  if (!node.children) return selfMatches
  return (
    selfMatches +
    node.children.reduce((total, child) => total + countMatchesInNode(child, repoName, query), 0)
  )
}

type FilterNodeResult = {
  node: TreeNode | null
  forcedOpenPaths: Set<string>
  matchCount: number
}

const filterNode = (node: TreeNode, repoName: string, query: string): FilterNodeResult => {
  const selfMatches = matchesNode(repoName, node.path, query)

  if (node.type === 'file') {
    return {
      node: selfMatches ? node : null,
      forcedOpenPaths: new Set<string>(),
      matchCount: selfMatches ? 1 : 0,
    }
  }

  if (selfMatches) {
    return {
      node,
      forcedOpenPaths: collectDirectoryPaths([node]),
      matchCount: countMatchesInNode(node, repoName, query),
    }
  }

  const forcedOpenPaths = new Set<string>()
  const children =
    node.children
      ?.map((child) => filterNode(child, repoName, query))
      .filter((result) => result.node !== null) ?? []

  const visibleChildren = children
    .map((result) => {
      for (const path of result.forcedOpenPaths) {
        forcedOpenPaths.add(path)
      }
      return result.node
    })
    .filter((child): child is TreeNode => child !== null)

  const matchCount = children.reduce((total, result) => total + result.matchCount, 0)

  if (visibleChildren.length === 0) {
    return { node: null, forcedOpenPaths, matchCount }
  }

  forcedOpenPaths.add(node.path)
  return {
    node: { ...node, children: visibleChildren },
    forcedOpenPaths,
    matchCount,
  }
}

export const filterTree = (nodes: TreeNode[], query: string, repoName: string): TreeFilterResult => {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) {
    return {
      nodes,
      forcedOpenPaths: new Set<string>(),
      matchCount: 0,
    }
  }

  const forcedOpenPaths = new Set<string>()
  const filteredNodes = nodes
    .map((node) => filterNode(node, repoName, normalizedQuery))
    .filter((result) => result.node !== null)

  let matchCount = 0
  for (const result of filteredNodes) {
    matchCount += result.matchCount
    for (const path of result.forcedOpenPaths) {
      forcedOpenPaths.add(path)
    }
  }

  return {
    nodes: filteredNodes.map((result) => result.node).filter((node): node is TreeNode => node !== null),
    forcedOpenPaths,
    matchCount,
  }
}
