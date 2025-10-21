import { create } from 'zustand'

type ViewContextState = ContextData & {
  getContext: () => ContextData
  setContext: (data: Partial<ContextData>) => void
  clearContext: () => void
}

type ContextData = {
  repo: string | null
  path: string | null
  pageNumber: number | null
}

export const useViewContext = create<ViewContextState>((set, get) => ({
  repo: null,
  path: null,
  pageNumber: null,
  getContext: () => {
    const { repo, path, pageNumber } = get()
    return { repo, path, pageNumber }
  },
  setContext: data => set(data),
  clearContext: () => set({ repo: null, path: null, pageNumber: null }),
}))

export function useGetContext() {
  return useViewContext(state => state.getContext)
}

export function useSetContext() {
  return useViewContext(state => state.setContext)
}
