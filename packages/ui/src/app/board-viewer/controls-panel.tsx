import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { ControlDef } from '@/types/board'

type ControlsPanelProps = {
  controls: Record<string, ControlDef>
  values: Record<string, number>
  onChange: (values: Record<string, number>) => void
}

export function ControlsPanel({ controls, values, onChange }: ControlsPanelProps) {
  const updateValue = (name: string, value: number) => {
    onChange({ ...values, [name]: value })
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap gap-x-6 gap-y-2 bg-background/80 backdrop-blur-sm rounded-md p-3 shadow-md">
      {Object.entries(controls).map(([name, def]) => (
        <ControlItem
          key={name}
          name={name}
          def={def}
          value={values[name] ?? 0}
          onChange={v => updateValue(name, v)}
        />
      ))}
    </div>
  )
}

type ControlItemProps = {
  name: string
  def: ControlDef
  value: number
  onChange: (value: number) => void
}

function ControlItem({ name, def, value, onChange }: ControlItemProps) {
  if (def.type === 'range') {
    return (
      <div className="flex items-center gap-2 min-w-48">
        <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">{name}</span>
        <Slider
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{value}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{name}</span>
      <Input
        type="number"
        min={def.min}
        max={def.max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-20 h-7 text-xs"
      />
    </div>
  )
}
