import { create } from 'zustand'

type ViewContextState = ContextData & {
  getContext: () => ContextData
  setContext: (data: Partial<ContextData>) => void
  clearContext: () => void
}

type ContextData = {
  repo: string | null
  path: string | null
}

export const useViewContext = create<ViewContextState>((set, get) => ({
  repo: null,
  path: null,
  getContext: () => {
    const { repo, path } = get()
    return { repo, path }
  },
  setContext: data => set(data),
  clearContext: () => set({ repo: null, path: null }),
}))

export function useGetContext() {
  return useViewContext(state => state.getContext)
}

export function useSetContext() {
  return useViewContext(state => state.setContext)
}
