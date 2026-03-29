"use client";

import { BrandTagChip } from "@/components/atoms/BrandTagChip";
import type { SourcePlatform } from "@/lib/schemas/source";
import { SourcePlatformSchema } from "@/lib/schemas/source";

interface SourcesFilterProps {
  allBrands: string[];
  selectedBrands: string[];
  selectedPlatform: SourcePlatform | "all";
  onToggleBrand: (brand: string) => void;
  onSelectPlatform: (platform: SourcePlatform | "all") => void;
}

export function SourcesFilter({
  allBrands,
  selectedBrands,
  selectedPlatform,
  onToggleBrand,
  onSelectPlatform,
}: SourcesFilterProps) {
  const platforms = ["all", ...SourcePlatformSchema.options];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-label-sm font-medium text-muted-foreground uppercase tracking-wide">Platform</span>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <BrandTagChip
              key={p}
              label={p === "all" ? "All Platforms" : p}
              variant="filter"
              active={selectedPlatform === p}
              onClick={() => onSelectPlatform(p as SourcePlatform | "all")}
            />
          ))}
        </div>
      </div>

      {allBrands.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-label-sm font-medium text-muted-foreground uppercase tracking-wide">Brand</span>
          <div className="flex flex-wrap gap-2">
            {allBrands.map((brand) => (
              <BrandTagChip
                key={brand}
                label={brand}
                variant="filter"
                active={selectedBrands.includes(brand)}
                onClick={() => onToggleBrand(brand)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
