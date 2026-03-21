"use client"

import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchField({ value, onChange, placeholder = "Search…", className }: SearchFieldProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        size={16}
        className="absolute left-3 text-muted-foreground pointer-events-none"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background pl-9 pr-8 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
