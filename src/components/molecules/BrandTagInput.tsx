"use client"

import { useState } from "react"
import { BrandTagChip } from "@/components/atoms/BrandTagChip"

interface BrandTagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export function BrandTagInput({ value, onChange }: BrandTagInputProps) {
  const [inputValue, setInputValue] = useState("")

  function addTag() {
    const trimmed = inputValue.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add brand tag..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring"
        />
        <button
          type="button"
          onClick={addTag}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm hover:bg-muted transition-colors"
        >
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <BrandTagChip key={tag} label={tag} onRemove={() => removeTag(tag)} />
          ))}
        </div>
      )}
    </div>
  )
}
