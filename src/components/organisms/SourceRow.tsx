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
        "group transition-opacity h-[80px]",
        !isActive && "opacity-50"
      )}
    >
      <TableCell className="w-[120px]">
        <PlatformBadge platform={source.platform as any} />
      </TableCell>
      
      <TableCell className="max-w-[300px]">
        <div className="flex flex-col gap-1">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm font-medium hover:underline truncate block"
          >
            {source.url}
          </a>
          <BrandTagGroup brands={source.brands || []} />
        </div>
      </TableCell>

      <TableCell className="max-w-[250px] overflow-hidden">
        <p className="text-body-xs text-muted-foreground line-clamp-2 italic">
          {source.notes || "No notes"}
        </p>
      </TableCell>

      <TableCell className="w-[200px]">
        <AttributionLine 
          email={attributionLabel} 
          date={source.created_at} 
        />
      </TableCell>

      <TableCell className="w-[80px] text-right">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={cn(
            "p-2 rounded-lg transition-colors border",
            isActive 
              ? "text-primary border-primary bg-primary/5 hover:bg-primary/10" 
              : "text-muted-foreground border-border hover:bg-muted"
          )}
          title={isActive ? "Deactivate source" : "Activate source"}
        >
          <Power size={18} />
        </button>
      </TableCell>
    </TableRow>
  );
}
