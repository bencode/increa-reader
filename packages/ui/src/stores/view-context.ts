import { create } from 'zustand'

export type ContextData = {
  repo: string | null
  path: string | null
  pageNumber: number | null
  quoteCount: number
}

type ViewContextState = ContextData & {
  getContext: () => ContextData
  setContext: (data: Partial<ContextData>) => void
  clearContext: () => void
}

export const useViewContext = create<ViewContextState>((set, get) => ({
  repo: null,
  path: null,
  pageNumber: null,
  quoteCount: 0,
  getContext: () => {
    const { repo, path, pageNumber, quoteCount } = get()
    return { repo, path, pageNumber, quoteCount }
  },
  setContext: data => set(data),
  clearContext: () => set({ repo: null, path: null, pageNumber: null, quoteCount: 0 }),
}))

export function useGetContext() {
  return useViewContext(state => state.getContext)
}

export function useSetContext() {
  return useViewContext(state => state.setContext)
}
