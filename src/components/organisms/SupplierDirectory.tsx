"use client"

import { useState } from "react"
import { SearchField } from "@/components/molecules/SearchField"
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup"
import { SupplierRow } from "@/components/organisms/SupplierRow"
import type { CatalogOption } from "@/lib/catalog"
import { getSupplierBrandNames, type SupplierBrandLink, type SupplierProductTypeLink } from "@/lib/supplier-catalog"
import type { Database } from "@/types/database"

type SupplierRowType = Database["public"]["Tables"]["suppliers"]["Row"]

export type SupplierWithStats = SupplierRowType & {
  supplier_brands?: SupplierBrandLink[]
  supplier_product_types?: SupplierProductTypeLink[]
  priceRange?: { min: number; max: number }
  activeInquiryCount: number
}

interface SupplierDirectoryProps {
  suppliers: SupplierWithStats[]
  allBrands: string[]
  brands?: CatalogOption[]
  productTypes?: CatalogOption[]
  addSupplierTrigger?: React.ReactNode
}

export function SupplierDirectory({
  suppliers,
  allBrands,
  brands = [],
  productTypes = [],
  addSupplierTrigger,
}: SupplierDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])

  function toggleBrand(brand: string) {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  function clearFilters() {
    setSearchTerm("")
    setSelectedBrands([])
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-body-sm text-muted-foreground">
          Add your first supplier to get started
        </p>
        {addSupplierTrigger}
      </div>
    )
  }

  const filtered = suppliers.filter((s) => {
    const matchesName = s.name.toLowerCase().includes(searchTerm.toLowerCase())
    const supplierBrands = getSupplierBrandNames(s)
    const matchesBrand =
      selectedBrands.length === 0 || selectedBrands.some((b) => supplierBrands.includes(b))
    return matchesName && matchesBrand
  })

  const activeFilter = searchTerm || selectedBrands.length > 0
  const noResultsLabel = searchTerm
    ? searchTerm
    : selectedBrands.join(", ")

  return (
    <div className="flex flex-col gap-4">
      <SearchField
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search suppliers…"
      />
      {allBrands.length > 0 && (
        <BrandTagGroup
          brands={allBrands}
          selectedBrands={selectedBrands}
          onToggle={toggleBrand}
        />
      )}
      {filtered.length === 0 && activeFilter ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-body-sm text-muted-foreground">
            No results for &ldquo;{noResultsLabel}&rdquo;
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-body-sm text-primary underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((supplier) => (
            <SupplierRow
              key={supplier.id}
              supplier={supplier}
              brands={brands}
              productTypes={productTypes}
              priceRange={supplier.priceRange}
              activeInquiryCount={supplier.activeInquiryCount}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
