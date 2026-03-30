import Link from "next/link";
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup";
import { PriceRange } from "@/components/atoms/PriceRange";
import { RedFlagIcon } from "@/components/atoms/RedFlagIcon";
import { SupplierSheet } from "@/components/organisms/SupplierSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type SupplierRowType = Database["public"]["Tables"]["suppliers"]["Row"];

interface SupplierRowProps {
  supplier: SupplierRowType;
  priceRange?: { min: number; max: number };
  activeInquiryCount: number;
}

export function SupplierRow({
  supplier,
  priceRange,
  activeInquiryCount,
}: SupplierRowProps) {
  return (
    <li className="group flex items-center justify-between border-b border-foreground/5 py-6 px-2 hover:bg-foreground/[0.02] transition-colors duration-500">
      <div className="flex flex-col gap-2 min-w-0">
        <Link
          href={`/suppliers/${supplier.id}`}
          className="text-sm font-semibold tracking-tight hover:text-primary transition-colors truncate"
        >
          {supplier.name}
        </Link>
        {supplier.brands.length > 0 && <BrandTagGroup brands={supplier.brands} />}
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
