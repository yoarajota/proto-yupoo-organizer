"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client"; // Use client for real-time or just simplified fetching in client component
import { SourceSheet } from "@/components/organisms/SourceSheet";
import { Button } from "@/components/ui/button";
import { SourcesFilter } from "@/components/molecules/SourcesFilter";
import { SourcesTable } from "@/components/organisms/SourcesTable";
import { DetailTemplate } from "@/components/templates/DetailTemplate";
import type { SourceWithProfile } from "@/components/organisms/SourceRow";
import type { SourcePlatform } from "@/lib/schemas/source";

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<SourcePlatform | "all">("all");

  const supabase = createClient();

  useEffect(() => {
    async function fetchSources() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("sources")
        .select("*, profiles(role)")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setSources(data as unknown as SourceWithProfile[]);
      }
      setIsLoading(false);
    }

    fetchSources();
  }, [supabase]);

  // Derived data
  const allBrands = Array.from(new Set(sources.flatMap((s) => s.brands || []))).sort();

  const filteredSources = sources.filter((s) => {
    const brandMatch =
      selectedBrands.length === 0 ||
      (s.brands && s.brands.some((b) => selectedBrands.includes(b)));
    const platformMatch = selectedPlatform === "all" || s.platform === selectedPlatform;
    return brandMatch && platformMatch;
  });

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedPlatform("all");
  };

  if (error) {
    return <div className="p-12 text-center text-destructive font-heading">Error loading repertoire: {error}</div>;
  }

  return (
    <DetailTemplate
      title="Source Library"
      breadcrumb={<span>Research Repertoire</span>}
      sideContent={
        <aside className="space-y-8">
          <div className="p-8 bg-foreground text-background space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">
              New Acquisition
            </h3>
            <p className="text-xs opacity-80 leading-relaxed italic">
              Record a new Yupoo album or social media profile for future
              sourcing reference.
            </p>
            <SourceSheet
              trigger={
                <Button className="w-full bg-background text-foreground hover:bg-background/90 rounded-none h-12 uppercase tracking-widest text-[10px] font-bold">
                  Register Source
                </Button>
              }
            />
          </div>

          <div className="p-8 border border-border/40 space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">
              Curation Filters
            </h3>
            <SourcesFilter
              allBrands={allBrands}
              selectedBrands={selectedBrands}
              selectedPlatform={selectedPlatform}
              onToggleBrand={toggleBrand}
              onSelectPlatform={setSelectedPlatform}
            />
          </div>
        </aside>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 px-1 border-b border-border/20 pb-4">
          <span>Cataloged Volume: {filteredSources.length}</span>
          {isLoading && <span className="animate-pulse italic">Retrieving archives...</span>}
        </div>

        <SourcesTable
          sources={filteredSources}
          onClearFilters={clearFilters}
          isFiltered={selectedBrands.length > 0 || selectedPlatform !== "all"}
        />
      </div>
    </DetailTemplate>
  );
}
