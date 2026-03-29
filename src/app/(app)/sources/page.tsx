"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client"; // Use client for real-time or just simplified fetching in client component
import { SourceSheet } from "@/components/organisms/SourceSheet";
import { Button } from "@/components/ui/button";
import { SourcesFilter } from "@/components/molecules/SourcesFilter";
import { SourcesTable } from "@/components/organisms/SourcesTable";
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
    return <div className="p-6 text-destructive">Error loading sources: {error}</div>;
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold tracking-tight">Source Library</h1>
          <p className="text-body-sm text-muted-foreground mt-1">
            Browse and manage research starting points.
          </p>
        </div>
        <SourceSheet trigger={<Button size="lg" className="rounded-full px-6 shadow-md">Add Source</Button>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-6 flex flex-col gap-6 p-6 rounded-2xl border border-border bg-surface-container-low shadow-sm">
          <SourcesFilter
            allBrands={allBrands}
            selectedBrands={selectedBrands}
            selectedPlatform={selectedPlatform}
            onToggleBrand={toggleBrand}
            onSelectPlatform={setSelectedPlatform}
          />
        </aside>

        <main className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-label-md text-muted-foreground px-1">
            <span>Showing {filteredSources.length} sources</span>
          </div>
          
          <SourcesTable
            sources={filteredSources}
            onClearFilters={clearFilters}
            isFiltered={selectedBrands.length > 0 || selectedPlatform !== "all"}
          />
        </main>
      </div>
    </div>
  );
}
