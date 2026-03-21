interface PriceRangeProps {
  min: number
  max: number
}

const fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function PriceRange({ min, max }: PriceRangeProps) {
  const display = min === max ? fmt.format(min) : `${fmt.format(min)}–${fmt.format(max)}`
  return (
    <span className="font-semibold text-primary text-body-sm text-right">{display}</span>
  )
}
