import { create } from 'zustand'

type BoardStoreState = {
  tabs: Record<string, string[]>
  activeTab: string | null
}

export const useBoardStore = create<BoardStoreState>(() => ({
  tabs: {},
  activeTab: null,
}))
