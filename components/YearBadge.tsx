/**
 * Small badge distinguishing first-year (Y1) from second-year (Y2) students.
 * Renders nothing for non-student / unset year values.
 */
type Props = {
  year: number | null | undefined
  className?: string
}

export function YearBadge({ year, className = '' }: Props) {
  if (year !== 1 && year !== 2) return null
  const isFirstYear = year === 1
  return (
    <span
      title={isFirstYear ? 'First year' : 'Second year'}
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 ${
        isFirstYear ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
      } ${className}`}
    >
      Y{year}
    </span>
  )
}
