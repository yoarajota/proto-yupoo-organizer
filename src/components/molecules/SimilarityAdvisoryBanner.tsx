"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissSimilarityMatch } from "@/actions/products";
import { useState } from "react";

interface SimilarityAdvisoryBannerProps {
  matches: any[]; // Ideally typed with Database type
}

export function SimilarityAdvisoryBanner({ matches }: SimilarityAdvisoryBannerProps) {
  const [activeMatches, setActiveMatches] = useState(matches);

  const handleDismiss = async (matchId: string) => {
    setActiveMatches((prev) => prev.filter((m) => m.id !== matchId));
    await dismissSimilarityMatch(matchId);
  };

  if (activeMatches.length === 0) return null;

  // Group by supplier if possible, or just show a summary
  const matchCount = activeMatches.length;
  
  // Extract unique supplier names from matches
  const suppliers = Array.from(new Set(
    activeMatches.map(m => m.matched_photo?.product?.inquiries?.length > 0 
      ? m.matched_photo.product.inquiries[0].supplier?.name 
      : "Unknown Supplier")
  )).filter(Boolean);

  const supplierText = suppliers.length > 0 
    ? ` — ${suppliers.join(", ")} uses similar images`
    : "";

  return (
    <div className="space-y-2 mb-6">
      {activeMatches.map((match) => (
        <Alert key={match.id} variant="warning" className="relative pr-12">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Similarity Advisory</AlertTitle>
          <AlertDescription>
            {matchCount} photo(s) match products already in your library{supplierText}
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={() => handleDismiss(match.id)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </Alert>
      ))}
    </div>
  );
}
