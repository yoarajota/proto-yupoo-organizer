import Link from "next/link";
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup";
import { PriceRange } from "@/components/atoms/PriceRange";
import { RedFlagIcon } from "@/components/atoms/RedFlagIcon";
import { SupplierSheet } from "@/components/organisms/SupplierSheet";
import { Button } from "@/components/ui/button";
import type { CatalogOption } from "@/lib/catalog";
import {
  getSupplierBrandNames,
  type SupplierBrandLink,
  type SupplierProductTypeLink,
} from "@/lib/supplier-catalog";
import type { Database } from "@/types/database";

type SupplierRowType = Database["public"]["Tables"]["suppliers"]["Row"] & {
  supplier_brands?: SupplierBrandLink[];
  supplier_product_types?: SupplierProductTypeLink[];
};

interface SupplierRowProps {
  supplier: SupplierRowType;
  brands?: CatalogOption[];
  productTypes?: CatalogOption[];
  priceRange?: { min: number; max: number };
  activeInquiryCount: number;
}

export function SupplierRow({
  supplier,
  brands = [],
  productTypes = [],
  priceRange,
  activeInquiryCount,
}: SupplierRowProps) {
  const brandNames = getSupplierBrandNames(supplier);

  return (
    <li className="group flex items-center justify-between border-b border-foreground/5 py-6 px-2 hover:bg-foreground/[0.02] transition-colors duration-500">
      <div className="flex flex-col gap-2 min-w-0">
        <Link
          href={`/suppliers/${supplier.id}`}
          className="text-sm font-semibold tracking-tight hover:text-primary transition-colors truncate"
        >
          {supplier.name}
        </Link>
        {brandNames.length > 0 && <BrandTagGroup brands={brandNames} />}
      </div>
      
      <div className="flex items-center gap-6 shrink-0">
        <div className="flex flex-col items-end gap-1">
          {priceRange && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-bold">Valuation</span>
              <PriceRange min={priceRange.min} max={priceRange.max} />
            </div>
          )}
          {activeInquiryCount > 0 && (
            <span className="text-[10px] uppercase tracking-tighter text-muted-foreground/60 font-medium">
              {activeInquiryCount} Active Threads
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {supplier.is_flagged && <RedFlagIcon />}
          <SupplierSheet
            supplier={supplier}
            brands={brands}
            productTypes={productTypes}
            trigger={
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-none h-8 px-4 text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 transition-opacity"
              >
                Inspect
              </Button>
            }
          />
        </div>
      </div>
    </li>
  );
}
