import { cn } from "@/lib/utils"
import { Calendar, User } from "lucide-react"

interface AttributionLineProps {
  email: string
  date: string | Date
  className?: string
}

export function AttributionLine({ email, date, className }: AttributionLineProps) {
  const formattedDate = typeof date === 'string' ? date : date.toLocaleDateString()

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-label-md text-muted-foreground", className)}>
      <div className="flex items-center gap-1">
        <User size={12} className="shrink-0" />
        <span>Added by {email}</span>
      </div>
      <div className="flex items-center gap-1">
        <Calendar size={12} className="shrink-0" />
        <span>{formattedDate}</span>
      </div>
    </div>
  )
}
