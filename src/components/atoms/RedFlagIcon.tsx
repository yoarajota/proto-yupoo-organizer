import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"

interface RedFlagIconProps {
  className?: string
}

export function RedFlagIcon({ className }: RedFlagIconProps) {
  return <Flag size={16} className={cn("text-error", className)} aria-label="Flagged supplier" />
}
