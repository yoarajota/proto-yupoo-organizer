"use client";

import { Tags } from "lucide-react";
import {
  CatalogManager,
  type CatalogSearchState,
} from "@/components/organisms/CatalogManager";
import type { CatalogPaginationState } from "@/app/(app)/workspace/data";
import type { BrandCatalogOption, CatalogOption } from "@/lib/catalog";

type CatalogWorkspaceProps = {
  brands: BrandCatalogOption[];
  productTypes: CatalogOption[];
  isAdmin: boolean;
  summary: {
    totalBrands: number;
    totalAliases: number;
    totalProductTypes: number;
  };
  pagination: {
    brands: CatalogPaginationState;
    productTypes: CatalogPaginationState;
  };
  searchState: CatalogSearchState;
};

export function CatalogWorkspace({
  brands,
  productTypes,
  isAdmin,
  summary,
  pagination,
  searchState,
}: CatalogWorkspaceProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 border border-border/70 bg-background p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Shared taxonomy
          </p>
          <h3 className="mt-2 text-lg font-heading text-foreground">
            Taxonomy Console
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Maintain the canonical registry for brand names, disguised aliases,
            and reusable product types.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1">
          <CatalogMiniMetric label="Brands" value={summary.totalBrands} />
          <CatalogMiniMetric label="Aliases" value={summary.totalAliases} />
          <CatalogMiniMetric label="Types" value={summary.totalProductTypes} />
        </div>
      </div>

      <CatalogManager
        brands={brands}
        productTypes={productTypes}
        isAdmin={isAdmin}
        summary={summary}
        pagination={pagination}
        searchState={searchState}
      />
    </div>
  );
}

function CatalogMiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border/70 bg-surface-container-lowest p-3">
      <div className="flex items-center justify-center gap-2 lg:justify-start">
        <Tags className="h-3.5 w-3.5 text-primary" />
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 text-xl font-heading leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}
