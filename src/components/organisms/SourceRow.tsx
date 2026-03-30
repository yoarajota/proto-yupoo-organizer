"use client";

import { useState, useTransition } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { PlatformBadge } from "@/components/molecules/PlatformBadge";
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup";
import { AttributionLine } from "@/components/atoms/AttributionLine";
import { toggleSourceActive } from "@/actions/sources";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import { Power } from "lucide-react";

type DBSource = Database["public"]["Tables"]["sources"]["Row"];

export interface SourceWithProfile extends DBSource {
  profiles?: {
    role: string;
  } | null;
}

interface SourceRowProps {
  source: SourceWithProfile;
}

export function SourceRow({ source }: SourceRowProps) {
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(source.is_active);

  const handleToggle = async () => {
    const nextValue = !isActive;
    setIsActive(nextValue); // Optimistic update
    
    startTransition(async () => {
      const result = await toggleSourceActive(source.id, nextValue);
      if (result.error) {
        setIsActive(source.is_active); // Rollback on error
        console.error(result.error.message);
      }
    });
  };

  const attributionLabel = source.profiles?.role 
    ? source.profiles.role.charAt(0).toUpperCase() + source.profiles.role.slice(1)
    : source.created_by.slice(0, 8);

  return (
    <TableRow
      className={cn(
        "group transition-all duration-700 h-[88px] border-b border-foreground/5 hover:bg-foreground/[0.01]",
        !isActive && "opacity-30 grayscale saturate-0"
      )}
    >
      <TableCell className="w-[120px] py-4">
        <PlatformBadge platform={source.platform as any} />
      </TableCell>
      
      <TableCell className="max-w-[320px] py-4">
        <div className="flex flex-col gap-1.5">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold tracking-tight hover:text-primary transition-colors truncate block"
          >
            {source.url.replace(/^https?:\/\//, '')}
          </a>
          <BrandTagGroup brands={source.brands || []} />
        </div>
      </TableCell>

      <TableCell className="max-w-[250px] py-4">
        <p className="text-[10px] italic text-muted-foreground/60 line-clamp-2 leading-relaxed">
          {source.notes || "No annotations provided."}
        </p>
      </TableCell>

      <TableCell className="w-[180px] py-4">
        <AttributionLine 
          email={attributionLabel} 
          date={source.created_at} 
          className="opacity-60 group-hover:opacity-100 transition-opacity"
        />
      </TableCell>

      <TableCell className="w-[100px] text-right pr-6 py-4">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={cn(
            "inline-flex items-center justify-center p-2.5 transition-all duration-500 rounded-none border border-transparent",
            isActive 
              ? "text-primary hover:bg-primary/5" 
              : "text-muted-foreground hover:text-foreground opacity-20 hover:opacity-100"
          )}
          title={isActive ? "Deactivate archive" : "Activate archive"}
        >
          <Power size={14} strokeWidth={isActive ? 3 : 2} />
        </button>
      </TableCell>
    </TableRow>
  );
}
