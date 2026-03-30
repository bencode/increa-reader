import { describe, expect, it } from 'vitest'

import type { TreeNode } from './api'
import { filterTree } from './tree-filter'

const sampleTree: TreeNode[] = [
  {
    type: 'dir',
    name: 'src',
    path: 'src',
    children: [
      {
        type: 'dir',
        name: 'app',
        path: 'src/app',
        children: [
          { type: 'file', name: 'left-panel.tsx', path: 'src/app/left-panel.tsx' },
          { type: 'file', name: 'chat.tsx', path: 'src/app/chat.tsx' },
        ],
      },
      {
        type: 'dir',
        name: 'utils',
        path: 'src/utils',
        children: [{ type: 'file', name: 'tree.ts', path: 'src/utils/tree.ts' }],
      },
    ],
  },
  {
    type: 'dir',
    name: 'docs',
    path: 'docs',
    children: [{ type: 'file', name: 'intro.md', path: 'docs/intro.md' }],
  },
]

describe('filterTree', () => {
  it('returns the original tree for an empty query', () => {
    const result = filterTree(sampleTree, '   ', 'increa-reader')

    expect(result.nodes).toBe(sampleTree)
    expect(result.forcedOpenPaths.size).toBe(0)
    expect(result.matchCount).toBe(0)
  })

  it('keeps the ancestor chain when a file path matches', () => {
    const result = filterTree(sampleTree, 'left-panel', 'increa-reader')

    expect(result.nodes).toEqual([
      {
        type: 'dir',
        name: 'src',
        path: 'src',
        children: [
          {
            type: 'dir',
            name: 'app',
            path: 'src/app',
            children: [{ type: 'file', name: 'left-panel.tsx', path: 'src/app/left-panel.tsx' }],
          },
        ],
      },
    ])
    expect([...result.forcedOpenPaths]).toEqual(['src/app', 'src'])
    expect(result.matchCount).toBe(1)
  })

  it('keeps the full subtree when a directory path matches', () => {
    const result = filterTree(sampleTree, 'src/app', 'increa-reader')

    expect(result.nodes).toEqual([
      {
        type: 'dir',
        name: 'src',
        path: 'src',
        children: [
          {
            type: 'dir',
            name: 'app',
            path: 'src/app',
            children: [
              { type: 'file', name: 'left-panel.tsx', path: 'src/app/left-panel.tsx' },
              { type: 'file', name: 'chat.tsx', path: 'src/app/chat.tsx' },
            ],
          },
        ],
      },
    ])
    expect(result.forcedOpenPaths.has('src')).toBe(true)
    expect(result.forcedOpenPaths.has('src/app')).toBe(true)
  })

  it('matches repo names as part of the full path', () => {
    const result = filterTree(sampleTree, 'increa-reader/docs', 'increa-reader')

    expect(result.nodes).toEqual([
      {
        type: 'dir',
        name: 'docs',
        path: 'docs',
        children: [{ type: 'file', name: 'intro.md', path: 'docs/intro.md' }],
      },
    ])
    expect(result.forcedOpenPaths.has('docs')).toBe(true)
  })

  it('matches case-insensitively', () => {
    const result = filterTree(sampleTree, 'LEFT-PANEL', 'increa-reader')

    expect(result.matchCount).toBe(1)
    expect(result.nodes[0]?.path).toBe('src')
  })

  it('returns an empty tree when nothing matches', () => {
    const result = filterTree(sampleTree, 'missing-file', 'increa-reader')

    expect(result.nodes).toEqual([])
    expect(result.forcedOpenPaths.size).toBe(0)
    expect(result.matchCount).toBe(0)
  })
})
