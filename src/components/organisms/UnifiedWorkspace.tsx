"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  MessageSquare,
  Package,
  Store,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/types/database";
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow";
import { InquiryTable } from "@/components/organisms/InquiryTable";
import {
  SupplierDirectory,
  type SupplierWithStats,
} from "@/components/organisms/SupplierDirectory";
import { SupplierSheet } from "@/components/organisms/SupplierSheet";
import { PhotoUploadZone } from "@/components/organisms/PhotoUploadZone";
import { ProductCard } from "@/components/organisms/ProductCard";
import { SourceSheet } from "@/components/organisms/SourceSheet";
import { SourcesFilter } from "@/components/molecules/SourcesFilter";
import { SourcesTable } from "@/components/organisms/SourcesTable";
import type { SourceWithProfile } from "@/components/organisms/SourceRow";
import type { SourcePlatform } from "@/lib/schemas/source";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MissionSheet } from "@/components/organisms/MissionSheet";
import { MissionsTable, type MissionRowType } from "@/components/organisms/MissionsTable";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type PhotoHashRow = Database["public"]["Tables"]["photo_hashes"]["Row"];

type ProductForCard = ProductRow & {
  photo_hashes: (PhotoHashRow & {
    similarity_matches?: { is_dismissed: boolean }[];
  })[];
};

type SectionId = "missions" | "inquiries" | "suppliers" | "products" | "sources";

interface UnifiedWorkspaceProps {
  missions: MissionRowType[];
  inquiries: InquiryWithSupplier[];
  suppliers: SupplierWithStats[];
  products: ProductForCard[];
  sources: SourceWithProfile[];
}

const sectionMeta: Record<
  SectionId,
  {
    label: string;
    caption: string;
    icon: LucideIcon;
  }
> = {
  missions: {
    label: "Missions",
    caption: "Autonomous sourcing agents.",
    icon: Target,
  },
  inquiries: {
    label: "Inquiries",
    caption: "Active negotiations and follow-ups.",
    icon: MessageSquare,
  },
  suppliers: {
    label: "Suppliers",
    caption: "Contacts, trust notes, and brand coverage.",
    icon: Store,
  },
  products: {
    label: "Products",
    caption: "Upload photos and inspect references.",
    icon: Package,
  },
  sources: {
    label: "Sources",
    caption: "Research links and channel intelligence.",
    icon: BookOpen,
  },
};

export function UnifiedWorkspace({
  missions,
  inquiries,
  suppliers,
  products,
  sources,
}: UnifiedWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("missions");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<
    SourcePlatform | "all"
  >("all");

  const allSourceBrands = useMemo(
    () =>
      Array.from(
        new Set(sources.flatMap((source) => source.brands || [])),
      ).sort(),
    [sources],
  );

  const allSupplierBrands = useMemo(
    () =>
      Array.from(
        new Set(suppliers.flatMap((supplier) => supplier.brands)),
      ).sort(),
    [suppliers],
  );

  const filteredSources = useMemo(
    () =>
      sources.filter((source) => {
        const brandMatch =
          selectedBrands.length === 0 ||
          (source.brands &&
            source.brands.some((brand) => selectedBrands.includes(brand)));
        const platformMatch =
          selectedPlatform === "all" || source.platform === selectedPlatform;

        return brandMatch && platformMatch;
      }),
    [selectedBrands, selectedPlatform, sources],
  );

  const sectionCounts: Record<SectionId, number> = {
    missions: missions.length,
    inquiries: inquiries.length,
    suppliers: suppliers.length,
    products: products.length,
    sources: sources.length,
  };

  const clearSourceFilters = () => {
    setSelectedBrands([]);
    setSelectedPlatform("all");
  };

  const toggleSourceBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((existingBrand) => existingBrand !== brand)
        : [...prev, brand],
    );
  };

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden border border-border/70 bg-gradient-to-br from-background via-surface-container-lowest to-surface-container-low px-5 py-6 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-foreground/10 blur-2xl" />

        <div className="relative space-y-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
            CRM workspace
          </div>
          <h1 className="text-3xl font-heading tracking-tight text-foreground sm:text-4xl">
            Board
          </h1>

          <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
            {(Object.keys(sectionMeta) as SectionId[]).map((sectionId) => {
              const section = sectionMeta[sectionId];
              const Icon = section.icon;

              return (
                <article
                  key={sectionId}
                  className="border border-border/80 bg-background/70 p-3"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider">
                      {section.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-heading leading-none text-foreground">
                    {sectionCounts[sectionId]}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </header>

      <div className="rounded-none border border-border/60 bg-background/85 p-2 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(sectionMeta) as SectionId[]).map((sectionId) => {
            const section = sectionMeta[sectionId];
            const Icon = section.icon;
            const active = sectionId === activeSection;

            return (
              <button
                key={sectionId}
                type="button"
                onClick={() => setActiveSection(sectionId)}
                className={cn(
                  "flex min-w-[150px] flex-1 items-center gap-2 border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide uppercase">
                    {section.label}
                  </p>
                  <p className="truncate text-[10px] opacity-80">
                    {section.caption}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="space-y-5">
        <header className="space-y-1">
          <h2 className="text-2xl font-heading tracking-tight text-foreground">
            {sectionMeta[activeSection].label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {sectionMeta[activeSection].caption}
          </p>
        </header>

        {activeSection === "missions" && (
          <div className="space-y-4 border border-border/60 bg-background p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
                Kick off autonomous AI search
              </p>
              <MissionSheet
                trigger={
                  <Button className="h-9 rounded-none px-4 text-[10px] uppercase tracking-widest">
                    New Mission
                  </Button>
                }
              />
            </div>

            <MissionsTable missions={missions} />
          </div>
        )}

        {activeSection === "inquiries" && (
          <div className="border border-border/60 bg-background p-3 sm:p-5">
            <InquiryTable
              inquiries={inquiries}
              showProductName={true}
              emptyMessage="No active inquiries right now."
            />
          </div>
        )}

        {activeSection === "suppliers" && (
          <div className="space-y-4 border border-border/60 bg-background p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
                Register and filter suppliers
              </p>
              <SupplierSheet
                trigger={
                  <Button className="h-9 rounded-none px-4 text-[10px] uppercase tracking-widest">
                    Add Supplier
                  </Button>
                }
              />
            </div>

            <SupplierDirectory
              suppliers={suppliers}
              allBrands={allSupplierBrands}
            />
          </div>
        )}

        {activeSection === "products" && (
          <div className="space-y-5 border border-border/60 bg-background p-4 sm:p-5">
            <div className="space-y-2 border-b border-border/50 pb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
                Upload and inspect product references
              </p>
              <PhotoUploadZone />
            </div>

            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products yet. Upload your first images to start.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === "sources" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
            <aside className="space-y-4 border border-border/60 bg-background p-4 sm:p-5">
              <div className="space-y-3 border-b border-border/50 pb-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
                  Add source
                </p>
                <SourceSheet
                  trigger={
                    <Button className="h-9 w-full rounded-none text-[10px] uppercase tracking-widest">
                      Register Source
                    </Button>
                  }
                />
              </div>

              <SourcesFilter
                allBrands={allSourceBrands}
                selectedBrands={selectedBrands}
                selectedPlatform={selectedPlatform}
                onToggleBrand={toggleSourceBrand}
                onSelectPlatform={setSelectedPlatform}
              />
            </aside>

            <div className="border border-border/60 bg-background p-3 sm:p-5">
              <SourcesTable
                sources={filteredSources}
                onClearFilters={clearSourceFilters}
                isFiltered={
                  selectedBrands.length > 0 || selectedPlatform !== "all"
                }
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
