"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface EditablePriceProps {
  initialPrice: number | null
  onSave: (newPrice: number | null) => Promise<void>
}

export function EditablePrice({ initialPrice, onSave }: EditablePriceProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialPrice === null ? "" : String(initialPrice))
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleSave = async () => {
    setIsEditing(false)
    const numValue = value.trim() === "" ? null : parseFloat(value)
    
    // Don't save if it hasn't changed
    if (numValue === initialPrice) return

    setIsSaving(true)
    await onSave(numValue)
    setIsSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setValue(initialPrice === null ? "" : String(initialPrice))
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="h-8 w-24 px-2 py-1 text-label-md"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div 
      className="cursor-pointer hover:bg-muted px-1 -mx-1 rounded min-h-[1.5rem] flex items-center"
      onClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
      }}
    >
      {isSaving ? (
        <span className="text-muted-foreground opacity-50">Saving...</span>
      ) : initialPrice !== null && initialPrice !== undefined ? (
        <span>¥{initialPrice}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </div>
  )
}
