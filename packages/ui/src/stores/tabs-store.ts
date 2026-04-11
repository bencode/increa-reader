import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const MAX_TABS = 20

export type Tab = {
  id: string
  repo: string
  path: string
  pageNumber: number | null
  lastActiveAt: number
}

type TabsState = {
  tabs: Tab[]
  activeId: string | null
  openTab: (repo: string, path: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setPageNumber: (id: string, page: number | null) => void
}

const normalizePath = (path: string) => (path.startsWith('/') ? path.slice(1) : path)

export const makeTabId = (repo: string, path: string) => `${repo}:${normalizePath(path)}`

function findEvictIndex(tabs: Tab[], activeId: string | null): number {
  let oldestIdx = -1
  let oldestTime = Number.POSITIVE_INFINITY
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i]
    if (tab.id === activeId) continue
    if (tab.lastActiveAt < oldestTime) {
      oldestTime = tab.lastActiveAt
      oldestIdx = i
    }
  }
  return oldestIdx === -1 ? 0 : oldestIdx
}

export const useTabsStore = create<TabsState>()(
  persist(
    set => ({
      tabs: [],
      activeId: null,
      openTab: (repo, path) =>
        set(state => {
          const cleanPath = normalizePath(path)
          const id = makeTabId(repo, cleanPath)
          const now = Date.now()
          const existing = state.tabs.find(t => t.id === id)
          if (existing) {
            return {
              activeId: id,
              tabs: state.tabs.map(t => (t.id === id ? { ...t, lastActiveAt: now } : t)),
            }
          }
          const newTab: Tab = {
            id,
            repo,
            path: cleanPath,
            pageNumber: null,
            lastActiveAt: now,
          }
          if (state.tabs.length < MAX_TABS) {
            return { activeId: id, tabs: [...state.tabs, newTab] }
          }
          const evictIdx = findEvictIndex(state.tabs, state.activeId)
          const nextTabs = state.tabs.slice()
          nextTabs.splice(evictIdx, 1, newTab)
          return { activeId: id, tabs: nextTabs }
        }),
      closeTab: id =>
        set(state => {
          const idx = state.tabs.findIndex(t => t.id === id)
          if (idx === -1) return state
          const nextTabs = state.tabs.filter(t => t.id !== id)
          let nextActive = state.activeId
          if (state.activeId === id) {
            const neighbor = state.tabs[idx + 1] ?? state.tabs[idx - 1] ?? null
            nextActive = neighbor ? neighbor.id : null
          }
          return { tabs: nextTabs, activeId: nextActive }
        }),
      setActiveTab: id =>
        set(state => ({
          activeId: id,
          tabs: state.tabs.map(t => (t.id === id ? { ...t, lastActiveAt: Date.now() } : t)),
        })),
      setPageNumber: (id, page) =>
        set(state => {
          const existing = state.tabs.find(t => t.id === id)
          if (!existing || existing.pageNumber === page) return state
          return {
            tabs: state.tabs.map(t => (t.id === id ? { ...t, pageNumber: page } : t)),
          }
        }),
    }),
    {
      name: 'tabs-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
