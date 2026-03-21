import { BrandTagChip } from "@/components/atoms/BrandTagChip"

interface BrandTagGroupProps {
  brands: string[]
  selectedBrands?: string[]
  onToggle?: (brand: string) => void
}

export function BrandTagGroup({ brands, selectedBrands = [], onToggle }: BrandTagGroupProps) {
  if (brands.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {brands.map((brand) =>
        onToggle ? (
          <BrandTagChip
            key={brand}
            label={brand}
            variant="filter"
            active={selectedBrands.includes(brand)}
            onClick={() => onToggle(brand)}
          />
        ) : (
          <BrandTagChip key={brand} label={brand} variant="display" />
        )
      )}
    </div>
  )
}
