import { InquiryWithSupplier } from "@/components/organisms/InquiryRow"
import { cn } from "@/lib/utils"

interface MarketOverviewCalloutProps {
  inquiries: InquiryWithSupplier[]
  className?: string
}

const fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function MarketOverviewCallout({ inquiries, className }: MarketOverviewCalloutProps) {
  const pricedInquiries = inquiries.filter(i => i.price !== null)
  const totalQuotes = pricedInquiries.length

  if (totalQuotes === 0) return null

  const prices = pricedInquiries.map(i => i.price as number)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  const decidedCount = inquiries.filter(i => i.status === 'decided').length
  const negotiatingCount = inquiries.filter(i => i.status === 'negotiating').length

  const priceDisplay = minPrice === maxPrice 
    ? fmt.format(minPrice) 
    : `${fmt.format(minPrice)}–${fmt.format(maxPrice)}`

  return (
    <div 
      role="region" 
      aria-label="Market Overview"
      className={cn(
        "flex flex-wrap items-center justify-between p-4 rounded-lg bg-surface-container-high border border-primary/10",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-label-md uppercase tracking-widest text-muted-foreground font-medium">Market Overview</span>
        <div className="h-4 w-px bg-border mx-1" />
        <span className="text-body-md font-semibold text-primary">
          {totalQuotes} {totalQuotes === 1 ? 'quote' : 'quotes'}: {priceDisplay}
        </span>
      </div>
      
      <div className="flex items-center gap-4 text-label-md text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          {decidedCount} decided
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {negotiatingCount} negotiating
        </span>
      </div>
    </div>
  )
}
