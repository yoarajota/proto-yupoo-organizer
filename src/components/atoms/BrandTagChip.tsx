"use client"

import { cn } from "@/lib/utils"

interface BrandTagChipProps {
  label: string
  variant?: "display" | "filter" | "removable"
  active?: boolean
  onClick?: () => void
  onRemove?: () => void
  className?: string
}

export function BrandTagChip({
  label,
  variant = "display",
  active = false,
  onClick,
  onRemove,
  className,
}: BrandTagChipProps) {
  if (variant === "filter") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-label-xs transition-colors",
          active
            ? "bg-surface-container-high text-foreground border border-transparent"
            : "bg-transparent text-muted-foreground border border-border",
          className
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-xs bg-surface-container-high text-foreground",
        className
      )}
    >
      {label}
      {(variant === "removable" || onRemove) && (
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
