"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface EditableNotesProps {
  initialNotes: string | null
  onSave: (newNotes: string | null) => Promise<void>
}

export function EditableNotes({ initialNotes, onSave }: EditableNotesProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialNotes || "")
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      // Move cursor to end
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length)
    }
  }, [isEditing])

  const handleSave = async () => {
    setIsEditing(false)
    const strValue = value.trim() === "" ? null : value.trim()
    
    // Don't save if it hasn't changed
    if (strValue === (initialNotes || null)) return

    setIsSaving(true)
    await onSave(strValue)
    setIsSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setValue(initialNotes || "")
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="h-8 max-w-[200px] px-2 py-1 text-label-md"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div 
      className="cursor-pointer hover:bg-muted px-1 -mx-1 rounded min-h-[1.5rem] flex items-center max-w-[200px]"
      onClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
      }}
    >
      {isSaving ? (
        <span className="text-label-md text-muted-foreground opacity-50">Saving...</span>
      ) : (
        <p className="text-label-md text-muted-foreground line-clamp-2" title={initialNotes || ""}>
          {initialNotes || "No notes"}
        </p>
      )}
    </div>
  )
}
