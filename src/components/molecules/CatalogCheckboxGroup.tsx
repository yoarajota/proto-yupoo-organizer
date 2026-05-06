"use client"

import type { CatalogOption } from "@/lib/catalog"
import { CatalogMultiAutocomplete } from "@/components/molecules/CatalogAutocomplete"

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
  return (
    <CatalogMultiAutocomplete
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={`Search ${label.toLowerCase()}`}
      emptyMessage={emptyMessage}
    />
  )
}
