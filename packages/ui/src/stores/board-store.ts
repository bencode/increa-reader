import { create } from 'zustand'
import type { BoardAnimation, RendererMode } from '@/types/board'

export type BoardTab = {
  instructions: string[]
  animation?: BoardAnimation
  renderer?: RendererMode
  errors?: Record<number, string>
}

type BoardStoreState = {
  tabs: Record<string, BoardTab>
  activeTab: string | null
}

const EMPTY_TAB: BoardTab = { instructions: [] }

export const useBoardStore = create<BoardStoreState>(() => ({
  tabs: {},
  activeTab: null,
}))

export function getTab(state: BoardStoreState, tabKey: string): BoardTab {
  return state.tabs[tabKey] ?? EMPTY_TAB
}

export function setAnimation(tabKey: string, config: BoardAnimation) {
  useBoardStore.setState(s => ({
    tabs: {
      ...s.tabs,
      [tabKey]: { ...getTab(s, tabKey), animation: config },
    },
  }))
}

export function setRenderer(tabKey: string, renderer: RendererMode) {
  useBoardStore.setState(s => ({
    tabs: {
      ...s.tabs,
      [tabKey]: { ...getTab(s, tabKey), renderer },
    },
  }))
}

export function setErrors(tabKey: string, errors: Record<number, string>) {
  useBoardStore.setState(s => ({
    tabs: {
      ...s.tabs,
      [tabKey]: { ...getTab(s, tabKey), errors },
    },
  }))
}
