"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InquiryStatusSchema, type InquiryStatus } from "@/lib/schemas/inquiry"
import { cn } from "@/lib/utils"

interface StatusDropdownProps {
  value: InquiryStatus
  onValueChange: (value: InquiryStatus) => void
  disabled?: boolean
  className?: string
}

const statusOptions: { value: InquiryStatus; label: string; color: string }[] = [
  { value: "sent", label: "Sent", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400" },
  { value: "price_received", label: "Price Received", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400" },
  { value: "negotiating", label: "Negotiating", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" },
  { value: "decided", label: "Decided", color: "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-400" },
  { value: "ghosted", label: "Ghosted", color: "bg-zinc-50 text-zinc-400 dark:bg-zinc-900/20 dark:text-zinc-500" },
]

export function StatusDropdown({
  value,
  onValueChange,
  disabled = false,
  className,
}: StatusDropdownProps) {
  const currentOption = statusOptions.find((opt) => opt.value === value)

  return (
    <Select
      value={value}
      onValueChange={(val) => onValueChange(val as InquiryStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "w-[140px] h-8 text-label-md font-medium border-0 transition-all",
          currentOption?.color,
          className
        )}
      >
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="text-label-md"
          >
            <span className={cn("inline-block w-2 h-2 rounded-full mr-2", opt.color.split(" ")[0])} />
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
      <div aria-live="polite" className="sr-only">
        Status changed to {currentOption?.label}
      </div>
    </Select>
  )
}
