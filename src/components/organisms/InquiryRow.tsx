"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { StatusDropdown } from "@/components/molecules/StatusDropdown"
import { AttributionLine } from "@/components/atoms/AttributionLine"
import { PhotoThumb } from "@/components/atoms/PhotoThumb"
import { updateInquiry } from "@/actions/inquiries"
import type { Database } from "@/types/database"
import type { InquiryStatus } from "@/lib/schemas/inquiry"
import { TableCell as TabCell, TableRow as TabRow } from "@/components/ui/table"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

type DBInquiry = Database["public"]["Tables"]["inquiries"]["Row"]

// Type for the joined inquiry data
export interface InquiryWithSupplier extends DBInquiry {
  suppliers: {
    name: string
  } | null
  products?: {
    notes: string | null
    photo_hashes?: {
      storage_path: string
      alt_text: string
    }[]
  } | null
}

interface InquiryRowProps {
  inquiry: InquiryWithSupplier
  showProductName?: boolean // In case we want to show it in the active list
  productName?: string
}

export function InquiryRow({ inquiry, showProductName, productName }: InquiryRowProps) {
  const router = useRouter()
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

  const handleRowClick = () => {
    router.push(`/products/${inquiry.product_id}`)
  }

  const firstPhotoPath = inquiry.products?.photo_hashes?.[0]?.storage_path
  const firstPhotoAlt = inquiry.products?.photo_hashes?.[0]?.alt_text || "Product photo"
  const photoSrc = firstPhotoPath ? `${SUPABASE_URL}/storage/v1/object/public/product-photos/${firstPhotoPath}` : ""

  return (
    <TabRow 
      key={inquiry.id} 
      className="group transition-colors h-[72px] cursor-pointer hover:bg-muted/50"
      onClick={handleRowClick}
    >
      {showProductName && (
         <TabCell className="font-medium text-body-sm align-top pt-4">
           <div className="flex items-center gap-3">
             <PhotoThumb 
               src={photoSrc} 
               alt={firstPhotoAlt}
               className="h-10 w-10 shrink-0"
               size="sm"
             />
             <Link 
               href={`/products/${inquiry.product_id}`}
               className="hover:underline font-medium relative z-10"
               onClick={(e: React.MouseEvent) => e.stopPropagation()}
             >
               {productName ?? 'Unknown Product'}
             </Link>
           </div>
         </TabCell>
      )}
      <TabCell className="align-top pt-4">
        <Link 
          href={`/suppliers/${inquiry.supplier_id}`}
          className="text-body-sm font-medium hover:underline text-primary relative z-10"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {inquiry.suppliers?.name || 'Unknown Supplier'}
        </Link>
      </TabCell>
      <TabCell className="align-top pt-3 relative z-10" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
