"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Plus,
  TrendingUp,
} from "lucide-react";
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow";
import { InquiryTable } from "@/components/organisms/InquiryTable";
import type { SupplierWithStats } from "@/components/organisms/SupplierDirectory";
import { PhotoUploadZone } from "@/components/organisms/PhotoUploadZone";
import { ProductCard } from "@/components/organisms/ProductCard";
import { SourcesFilter } from "@/components/molecules/SourcesFilter";
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup";
import { SourcesTable } from "@/components/organisms/SourcesTable";
import type { SourceWithProfile } from "@/components/organisms/SourceRow";
import type { SourcePlatform } from "@/lib/schemas/source";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MissionsTable, type MissionRowType } from "@/components/organisms/MissionsTable";
import { CatalogWorkspace } from "@/components/organisms/CatalogWorkspace";
import type { BrandCatalogOption, CatalogOption } from "@/lib/catalog";
import { getSupplierBrandNames } from "@/lib/supplier-catalog";
import type {
  CatalogPaginationState,
  ProductForCard,
} from "@/app/(app)/workspace/data";
import {
  getWorkspaceSectionHref,
  workspaceSectionMeta,
  type WorkspaceSectionId,
} from "@/components/organisms/workspace-sections";

interface UnifiedWorkspaceProps {
  activeSection: WorkspaceSectionId;
  isAdmin: boolean;
  missions: MissionRowType[];
  inquiries: InquiryWithSupplier[];
  suppliers: SupplierWithStats[];
  products: ProductForCard[];
  sources: SourceWithProfile[];
  brands: BrandCatalogOption[];
  productTypes: CatalogOption[];
  catalogSummary: {
    totalBrands: number;
    totalAliases: number;
    totalProductTypes: number;
  };
  catalogPagination: {
    brands: CatalogPaginationState;
    productTypes: CatalogPaginationState;
  };
}

export function UnifiedWorkspace({
  activeSection,
  isAdmin,
  missions,
  inquiries,
  suppliers,
  products,
  sources,
  brands,
  productTypes,
  catalogSummary,
  catalogPagination,
}: UnifiedWorkspaceProps) {
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

  const sectionCounts: Record<WorkspaceSectionId, number> = {
    missions: missions.length,
    catalog: catalogSummary.totalBrands + catalogSummary.totalProductTypes,
    inquiries: inquiries.length,
    suppliers: suppliers.length,
    products: products.length,
    sources: sources.length,
  };

  const missionStats = useMemo(() => {
    const active = missions.filter((mission) =>
      ["discovery_queued", "scanning", "classification_queued", "classifying_categories", "matching_queued", "matching"].includes(mission.status),
    ).length;
    const failed = missions.filter((mission) =>
      ["failed_retrying", "failed_terminal"].includes(mission.status),
    ).length;
    const completed = missions.filter((mission) => mission.status === "completed").length;

    return { active, failed, completed };
  }, [missions]);

  const flowSections: WorkspaceSectionId[] = [
    "missions",
    "sources",
    "suppliers",
    "products",
    "catalog",
    "inquiries",
  ];

  const activeSectionIndex = flowSections.indexOf(activeSection);

  const workspaceHref = (sectionId: WorkspaceSectionId) => {
    return getWorkspaceSectionHref(sectionId);
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
    <div className="space-y-6">
      <WorkspaceCandidateHeader
        missionStats={missionStats}
        inquiriesCount={inquiries.length}
        suppliers={suppliers}
        productsCount={products.length}
        sourcesCount={sources.length}
        catalogSummary={catalogSummary}
      />

      <div
        className="border border-border/70 bg-background p-2"
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {flowSections.map((sectionId, index) => {
            const section = workspaceSectionMeta[sectionId];
            const Icon = section.icon;
            const active = sectionId === activeSection;
            const complete = index < activeSectionIndex;

            return (
              <Link
                key={sectionId}
                href={workspaceHref(sectionId)}
                className={cn(
                  "group flex min-w-[190px] flex-1 items-center gap-3 border px-3 py-3 text-left transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : complete
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-surface-container-lowest text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center border",
                  active ? "border-background/30" : "border-border bg-background",
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-75">
                    Step {index + 1}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {section.label} <span className="font-normal opacity-70">({sectionCounts[sectionId]})</span>
                  </p>
                  <p className="truncate text-[10px] opacity-80">
                    {section.caption}
                  </p>
                </div>
                {index < flowSections.length - 1 && (
                  <ArrowRight className="ml-auto hidden h-3.5 w-3.5 opacity-40 xl:block" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="space-y-5">
        <header className="flex flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
          <h2 className="text-xl font-heading tracking-tight text-foreground sm:text-2xl">
            {workspaceSectionMeta[activeSection].label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {workspaceSectionMeta[activeSection].caption}
          </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {sectionCounts[activeSection]} records
          </p>
        </header>

        {activeSection === "missions" && (
          <div className="space-y-4 border border-border/60 bg-background p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
                Kick off autonomous AI search
              </p>
              <Link
                href="/workspace/missions/new"
                className={cn(
                  buttonVariants(),
                  "h-9 rounded-none px-4 text-[10px] uppercase tracking-widest",
                )}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                New Mission
              </Link>
            </div>

            <MissionsTable
              missions={missions}
              brands={brands}
              productTypes={productTypes}
              isAdmin={isAdmin}
            />
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

        {activeSection === "catalog" && (
          <div className="space-y-4 border border-border/60 bg-background p-4 sm:p-5">
            <div className="border-b border-border/50 pb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
                {isAdmin
                  ? "Register reusable values for products and suppliers"
                  : "Browse the shared taxonomy used across sourcing workflows"}
              </p>
            </div>

            <CatalogWorkspace
              brands={brands}
              productTypes={productTypes}
              isAdmin={isAdmin}
              summary={catalogSummary}
              pagination={catalogPagination}
              searchState={{
                brandQuery: catalogPagination.brands.query,
                brandPage: catalogPagination.brands.page,
                productTypeQuery: catalogPagination.productTypes.query,
                productTypePage: catalogPagination.productTypes.page,
              }}
            />
          </div>
        )}

        {activeSection === "suppliers" && (
          <SupplierSourceResearchBoard
            suppliers={suppliers}
            sources={sources}
            allSourceBrands={allSourceBrands}
            selectedBrands={selectedBrands}
            selectedPlatform={selectedPlatform}
            onToggleBrand={toggleSourceBrand}
            onSelectPlatform={setSelectedPlatform}
            onClearFilters={clearSourceFilters}
            isFiltered={selectedBrands.length > 0 || selectedPlatform !== "all"}
            filteredSources={filteredSources}
          />
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
          <SupplierSourceResearchBoard
            suppliers={suppliers}
            sources={sources}
            allSourceBrands={allSourceBrands}
            selectedBrands={selectedBrands}
            selectedPlatform={selectedPlatform}
            onToggleBrand={toggleSourceBrand}
            onSelectPlatform={setSelectedPlatform}
            onClearFilters={clearSourceFilters}
            isFiltered={selectedBrands.length > 0 || selectedPlatform !== "all"}
            filteredSources={filteredSources}
          />
        )}
      </section>
    </div>
  );
}

function SupplierSourceResearchBoard({
  suppliers,
  sources,
  allSourceBrands,
  selectedBrands,
  selectedPlatform,
  onToggleBrand,
  onSelectPlatform,
  onClearFilters,
  isFiltered,
  filteredSources,
}: {
  suppliers: SupplierWithStats[];
  sources: SourceWithProfile[];
  allSourceBrands: string[];
  selectedBrands: string[];
  selectedPlatform: SourcePlatform | "all";
  onToggleBrand: (brand: string) => void;
  onSelectPlatform: (platform: SourcePlatform | "all") => void;
  onClearFilters: () => void;
  isFiltered: boolean;
  filteredSources: SourceWithProfile[];
}) {
  const flaggedSuppliers = suppliers.filter((supplier) => supplier.is_flagged);
  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.activeInquiryCount > 0,
  );
  const supplierBrands = Array.from(
    new Set(suppliers.flatMap((supplier) => getSupplierBrandNames(supplier))),
  );
  const sourceBrands = Array.from(new Set(sources.flatMap((source) => source.brands ?? [])));
  const overlapBrands = supplierBrands.filter((brand) => sourceBrands.includes(brand));

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4 border border-border/70 bg-background p-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Intelligence board
          </p>
          <h3 className="mt-2 text-lg font-heading text-foreground">
            Supplier evidence map
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Compare active supplier memory against source coverage and unresolved risk.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Suppliers" value={suppliers.length} />
          <MiniMetric label="Sources" value={sources.length} />
          <MiniMetric label="Live" value={activeSuppliers.length} />
          <MiniMetric label="Flagged" value={flaggedSuppliers.length} />
        </div>

        <div className="border-t border-border/70 pt-4">
          <SourcesFilter
            allBrands={allSourceBrands}
            selectedBrands={selectedBrands}
            selectedPlatform={selectedPlatform}
            onToggleBrand={onToggleBrand}
            onSelectPlatform={onSelectPlatform}
          />
          {isFiltered && (
            <Button
              variant="outline"
              className="mt-3 h-9 w-full rounded-none text-[10px] uppercase tracking-widest"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        <section className="grid min-w-0 gap-3 lg:grid-cols-[repeat(2,minmax(0,1fr))] 2xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          {suppliers.map((supplier) => {
            const brands = getSupplierBrandNames(supplier);
            const matchingSources = sources.filter((source) =>
              (source.brands ?? []).some((brand) => brands.includes(brand)),
            );

            return (
              <article
                key={supplier.id}
                className="min-h-[230px] min-w-0 border border-border/70 bg-surface-container-lowest p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="line-clamp-1 text-base font-heading text-foreground hover:text-primary"
                    >
                      {supplier.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {supplier.activeInquiryCount} active threads
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest",
                      supplier.is_flagged
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-primary/40 bg-primary/10 text-primary",
                    )}
                  >
                    {supplier.is_flagged ? "Flagged" : "Trusted"}
                  </span>
                </div>

                <div className="mt-4">
                  <BrandTagGroup brands={brands.slice(0, 4)} />
                </div>

                <div className="mt-4 border-t border-border/70 pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Source evidence
                  </p>
                  <p className="mt-2 text-2xl font-heading">{matchingSources.length}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {matchingSources.length > 0
                      ? `${matchingSources.length} registered source${matchingSources.length === 1 ? "" : "s"} mention this supplier coverage.`
                      : "No registered source currently supports these brands."}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="border border-border/70 bg-background p-3 sm:p-4">
            <SourcesTable
              sources={filteredSources}
              onClearFilters={onClearFilters}
              isFiltered={isFiltered}
            />
          </div>
          <aside className="space-y-3 border border-border/70 bg-surface-container-low p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Coverage overlap
            </p>
            <div className="space-y-2">
              {overlapBrands.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No brand overlap between supplier records and source annotations yet.
                </p>
              ) : (
                <BrandTagGroup brands={overlapBrands} />
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function WorkspaceCandidateHeader({
  missionStats,
  inquiriesCount,
  suppliers,
  productsCount,
  sourcesCount,
  catalogSummary,
}: {
  missionStats: { active: number; failed: number; completed: number };
  inquiriesCount: number;
  suppliers: SupplierWithStats[];
  productsCount: number;
  sourcesCount: number;
  catalogSummary: {
    totalBrands: number;
    totalAliases: number;
    totalProductTypes: number;
  };
}) {
  const suppliersWithInquiries = suppliers.filter(
    (supplier) => supplier.activeInquiryCount > 0,
  ).length;
  const flaggedSuppliers = suppliers.filter((supplier) => supplier.is_flagged).length;
  const needsReview = missionStats.failed + flaggedSuppliers;
  const nextActionTitle =
    missionStats.failed > 0
      ? "Resolve mission diagnostics"
      : inquiriesCount > 0
        ? "Review active supplier replies"
        : "Start with a focused scrape";
  const nextActionCopy =
    missionStats.failed > 0
      ? "Failed missions are retryable from the mission table. Keep error context close to the source URL before rerunning."
      : inquiriesCount > 0
        ? "Open inquiries with price changes or notes should be moved toward decision while supplier memory is fresh."
        : "Seed a mission from a Yupoo shop or category page, then promote validated sources into the directory.";

  return (
    <header className="border border-border/70 bg-background">
      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6 p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Market Atelier
              </p>
              <h1 className="mt-2 text-2xl font-heading leading-tight text-foreground sm:text-3xl">
                Sourcing workspace
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Track autonomous missions, verify source intelligence, shape supplier coverage, and move product references into active inquiries.
              </p>
            </div>
            <Link
              href="/workspace/missions/new"
              className={cn(
                buttonVariants(),
                "h-10 rounded-none px-4 text-[10px] uppercase tracking-widest",
              )}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Mission
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <WorkspaceSignal label="Active missions" value={missionStats.active} detail={`${missionStats.completed} completed scans`} icon={Clock3} />
            <WorkspaceSignal label="Supplier coverage" value={suppliers.length} detail={`${suppliersWithInquiries} with live inquiries`} icon={TrendingUp} />
            <WorkspaceSignal label="Product references" value={productsCount} detail={`${catalogSummary.totalBrands} catalog brands`} icon={CheckCircle2} />
            <WorkspaceSignal label="Needs review" value={needsReview} detail={`${missionStats.failed} mission diagnostics`} icon={AlertTriangle} tone="warning" />
          </div>
        </div>

        <aside className="border-t border-border/70 bg-surface-container-low p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Next action
          </p>
          <h2 className="mt-2 text-lg font-heading text-foreground">{nextActionTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{nextActionCopy}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <MiniMetric label="Sources" value={sourcesCount} />
            <MiniMetric label="Inquiries" value={inquiriesCount} />
            <MiniMetric label="Aliases" value={catalogSummary.totalAliases} />
          </div>
        </aside>
      </div>
    </header>
  );
}

function WorkspaceSignal({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ElementType;
  tone?: "default" | "warning";
}) {
  return (
    <article className="border border-border/70 bg-surface-container-lowest p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-4 w-4", tone === "warning" ? "text-amber-700" : "text-primary")} />
      </div>
      <p className="mt-3 text-2xl font-heading leading-none text-foreground sm:mt-4 sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground sm:text-xs">{detail}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border/70 bg-background p-3">
      <p className="text-lg font-heading leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
