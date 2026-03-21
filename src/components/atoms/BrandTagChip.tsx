"use client"

import { cn } from "@/lib/utils"

interface BrandTagChipProps {
  label: string
  onRemove?: () => void
  className?: string
}

export function BrandTagChip({ label, onRemove, className }: BrandTagChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-xs bg-surface-container-high text-foreground",
        className
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="ml-0.5 rounded-full hover:bg-surface-container-low transition-colors leading-none"
        >
          ✕
        </button>
      )}
    </span>
  )
}
