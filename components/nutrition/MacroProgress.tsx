import { Progress } from '@/components/ui/progress'

type Props = {
  label: string
  current: number
  target: number
  unit: string
}

export function MacroProgress({ label, current, target, unit }: Props) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
  const over = target > 0 && current > target

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span className={over ? 'text-amber-600' : ''}>
          {Math.round(current)}{unit} / {target}{unit}
        </span>
      </div>
      <Progress value={pct} className={`h-2 ${over ? '[&>div]:bg-amber-500' : '[&>div]:bg-tranmere-blue'}`} />
    </div>
  )
}
