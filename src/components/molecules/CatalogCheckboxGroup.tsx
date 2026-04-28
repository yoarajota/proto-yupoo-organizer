"use client"

import type { CatalogOption } from "@/lib/catalog"
import { cn } from "@/lib/utils"

type CatalogCheckboxGroupProps = {
  label: string
  options: CatalogOption[]
  value: string[]
  onChange: (value: string[]) => void
  emptyMessage: string
}

export function CatalogCheckboxGroup({
  label,
  options,
  value,
  onChange,
  emptyMessage,
}: CatalogCheckboxGroupProps) {
  function toggle(optionId: string) {
    onChange(
      value.includes(optionId)
        ? value.filter((id) => id !== optionId)
        : [...value, optionId],
    )
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label-sm font-medium">{label}</legend>
      {options.length === 0 ? (
        <p className="text-label-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = value.includes(option.id)

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-3 py-1 text-label-xs transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {option.name}
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
