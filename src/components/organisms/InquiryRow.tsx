"use client"

import { useState } from "react"
import Link from "next/link"
import { StatusDropdown } from "@/components/molecules/StatusDropdown"
import { AttributionLine } from "@/components/atoms/AttributionLine"
import { updateInquiry } from "@/actions/inquiries"
import type { Database } from "@/types/database"
import type { InquiryStatus } from "@/lib/schemas/inquiry"
import { cn } from "@/lib/utils"
import { TableCell as TabCell, TableRow as TabRow } from "@/components/ui/table"

type DBInquiry = Database["public"]["Tables"]["inquiries"]["Row"]

// Type for the joined inquiry data
export interface InquiryWithSupplier extends DBInquiry {
  suppliers: {
    name: string
  } | null
  products?: {
    notes: string | null
  } | null
}

interface InquiryRowProps {
  inquiry: InquiryWithSupplier
  showProductName?: boolean // In case we want to show it in the active list
  productName?: string
}

export function InquiryRow({ inquiry, showProductName, productName }: InquiryRowProps) {
  const [status, setStatus] = useState<InquiryStatus>(inquiry.status)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (newStatus: InquiryStatus) => {
    setIsUpdating(true)
    setStatus(newStatus)
    const result = await updateInquiry(inquiry.id, { status: newStatus })
    if (result.error) {
      console.error(result.error.message)
      setStatus(inquiry.status) // revert on error
    }
    setIsUpdating(false)
  }

  return (
    <TabRow key={inquiry.id} className="group transition-colors h-[72px]">
      {showProductName && (
         <TabCell className="font-medium text-body-sm align-top pt-4">
           {productName ?? 'Unknown Product'}
         </TabCell>
      )}
      <TabCell className="align-top pt-4">
        <Link 
          href={`/suppliers/${inquiry.supplier_id}`}
          className="text-body-sm font-medium hover:underline text-primary"
        >
          {inquiry.suppliers?.name || 'Unknown Supplier'}
        </Link>
      </TabCell>
      <TabCell className="align-top pt-3">
        <StatusDropdown 
          value={status} 
          onValueChange={handleStatusChange} 
          disabled={isUpdating}
        />
      </TabCell>
      <TabCell className="align-top pt-4 text-body-sm">
        {inquiry.price ? `¥${inquiry.price}` : <span className="text-muted-foreground">—</span>}
      </TabCell>
      <TabCell className="align-top pt-4 max-w-[200px]">
        <p className="text-label-md text-muted-foreground line-clamp-2">
          {inquiry.notes || "No notes"}
        </p>
      </TabCell>
      <TabCell className="align-top pt-4 text-right">
        <AttributionLine 
          email={inquiry.created_by} // In a real app we'd join with profiles.email
          date={inquiry.created_at}
          className="justify-end"
        />
      </TabCell>
    </TabRow>
  )
}
