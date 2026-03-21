import { TrendingDown, TrendingUp } from "lucide-react"

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface NegotiationElasticityProps {
  openingPrice?: number | null
  finalPrice?: number | null
}

export function NegotiationElasticity({ openingPrice, finalPrice }: NegotiationElasticityProps) {
  if (openingPrice == null || finalPrice == null) {
    return <span className="text-label-sm text-muted-foreground">No elasticity data</span>
  }

  const pct = Math.round(((finalPrice - openingPrice) / openingPrice) * 100)
  const isDown = pct < 0

  return (
    <div className="flex items-center gap-2 text-body-sm">
      <span>{brlFormatter.format(openingPrice)}</span>
      <span className="text-muted-foreground">→</span>
      <span>{brlFormatter.format(finalPrice)}</span>
      <span className={isDown ? "text-error" : "text-primary"}>
        {isDown ? (
          <TrendingDown className="inline size-4 mr-0.5" />
        ) : (
          <TrendingUp className="inline size-4 mr-0.5" />
        )}
        {pct > 0 ? "+" : ""}{pct}% avg
      </span>
    </div>
  )
}
