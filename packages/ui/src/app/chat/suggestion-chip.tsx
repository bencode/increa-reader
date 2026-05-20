import { Button } from '@/components/ui/button'
import { useSuggestionStore } from '@/stores/suggestion-store'

type SuggestionChipProps = {
  onPick: (prompt: string) => void
}

export const SuggestionChip = ({ onPick }: SuggestionChipProps) => {
  const suggestion = useSuggestionStore(s => s.suggestion)
  const clear = useSuggestionStore(s => s.clear)

  if (!suggestion) return null

  return (
    <div className="px-4 pt-2 -mb-1 flex">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs h-7 font-mono text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
        onClick={() => {
          onPick(suggestion.prompt)
          clear()
        }}
        title={suggestion.prompt}
      >
        <span aria-hidden className="opacity-60">
          ›
        </span>
        {suggestion.label}
      </Button>
    </div>
  )
}
