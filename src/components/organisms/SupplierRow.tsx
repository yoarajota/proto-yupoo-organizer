import Link from "next/link"
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup"
import { PriceRange } from "@/components/atoms/PriceRange"
import { RedFlagIcon } from "@/components/atoms/RedFlagIcon"
import { SupplierSheet } from "@/components/organisms/SupplierSheet"
import { Button } from "@/components/ui/button"
import type { Database } from "@/types/database"

type SupplierRowType = Database["public"]["Tables"]["suppliers"]["Row"]

interface SupplierRowProps {
  supplier: SupplierRowType
  priceRange?: { min: number; max: number }
  activeInquiryCount: number
}

export function SupplierRow({ supplier, priceRange, activeInquiryCount }: SupplierRowProps) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-surface-container-low px-4 py-3 gap-4">
      <div className="flex flex-col gap-1 min-w-0">
        <Link
          href={`/suppliers/${supplier.id}`}
          className="text-body-sm font-medium hover:underline truncate"
        >
          {supplier.name}
        </Link>
        {supplier.brands.length > 0 && (
          <BrandTagGroup brands={supplier.brands} />
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {priceRange && <PriceRange min={priceRange.min} max={priceRange.max} />}
        {activeInquiryCount > 0 && (
          <span className="text-label-xs text-muted-foreground">
            {activeInquiryCount} active
          </span>
        )}
        {supplier.is_flagged && <RedFlagIcon />}
        <SupplierSheet
          supplier={supplier}
          trigger={
            <Button variant="outline" size="sm">
              Edit
            </Button>
          }
        />
      </div>
    </li>
  )
}
