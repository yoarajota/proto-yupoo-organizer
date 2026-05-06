"use client"

import { useMemo, useState } from "react"
import { Check, X } from "lucide-react"
import type { CatalogOption } from "@/lib/catalog"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type CatalogAutocompleteProps = {
  label: string
  options: CatalogOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  emptyMessage: string
  getOptionValue?: (option: CatalogOption) => string
  allowCustomValue?: boolean
}

type CatalogMultiAutocompleteProps = {
  label: string
  options: CatalogOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  emptyMessage: string
}

function optionValue(option: CatalogOption) {
  return option.id
}

function findOption(
  options: CatalogOption[],
  value: string,
  getValue: (option: CatalogOption) => string,
) {
  return options.find((option) => getValue(option) === value)
}

export function CatalogAutocomplete({
  label,
  options,
  value,
  onChange,
  placeholder,
  emptyMessage,
  getOptionValue = optionValue,
  allowCustomValue = false,
}: CatalogAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const selectedOption = findOption(options, value, getOptionValue)
  const inputValue = selectedOption?.name ?? value

  return (
    <div className="relative space-y-1.5">
      <label className="text-label-sm font-medium">{label}</label>
      <Command className="rounded-md border border-input bg-background p-0">
        <CommandInput
          value={inputValue}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onValueChange={(nextValue) => {
            setOpen(true)
            if (allowCustomValue) onChange(nextValue)
          }}
          placeholder={placeholder}
          className="h-8"
        />
        {open && (
          <CommandList
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 rounded-md border bg-popover shadow-md"
            onMouseDown={(event) => event.preventDefault()}
          >
            <CommandEmpty className="py-3 text-label-xs text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>
            {options.map((option) => {
              const resolvedValue = getOptionValue(option)
              const selected = resolvedValue === value

              return (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.slug ?? ""}`}
                  data-checked={selected}
                  onSelect={() => {
                    onChange(resolvedValue)
                    setOpen(false)
                  }}
                >
                  <span>{option.name}</span>
                  {option.slug && (
                    <span className="ml-auto text-label-xs text-muted-foreground">
                      {option.slug}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandList>
        )}
      </Command>
    </div>
  )
}

export function CatalogMultiAutocomplete({
  label,
  options,
  value,
  onChange,
  placeholder,
  emptyMessage,
}: CatalogMultiAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const selectedOptions = useMemo(
    () => value.map((selectedValue) => findOption(options, selectedValue, optionValue)).filter(Boolean) as CatalogOption[],
    [options, value],
  )

  function toggle(optionId: string) {
    onChange(
      value.includes(optionId)
        ? value.filter((id) => id !== optionId)
        : [...value, optionId],
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-label-sm font-medium">{label}</legend>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <Badge key={option.id} variant="secondary" className="gap-1">
              {option.name}
              <button
                type="button"
                onClick={() => toggle(option.id)}
                className="rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${option.name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Command className="rounded-md border border-input bg-background p-0">
          <CommandInput
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder={placeholder}
            className="h-8"
          />
          {open && (
            <CommandList
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 rounded-md border bg-popover shadow-md"
              onMouseDown={(event) => event.preventDefault()}
            >
              <CommandEmpty className="py-3 text-label-xs text-muted-foreground">
                {emptyMessage}
              </CommandEmpty>
              {options.map((option) => {
                const selected = value.includes(option.id)

                return (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => toggle(option.id)}
                    className={cn(selected && "bg-muted")}
                  >
                    <span>{option.name}</span>
                    {selected && <Check className="ml-auto size-4" />}
                  </CommandItem>
                )
              })}
            </CommandList>
          )}
        </Command>
      </div>
    </fieldset>
  )
}
