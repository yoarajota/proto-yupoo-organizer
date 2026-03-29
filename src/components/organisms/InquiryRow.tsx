"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { StatusDropdown } from "@/components/molecules/StatusDropdown"
import { EditablePrice } from "@/components/molecules/EditablePrice"
import { EditableNotes } from "@/components/molecules/EditableNotes"
import { AttributionLine } from "@/components/atoms/AttributionLine"
import { PhotoThumb } from "@/components/atoms/PhotoThumb"
import { updateInquiry, updateInquiryPrice, updateInquiryNotes } from "@/actions/inquiries"
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
  profiles?: {
    id: string
    role: string
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

  const handlePriceChange = async (newPrice: number | null) => {
    const result = await updateInquiryPrice(inquiry.id, newPrice)
    if (result.error) {
      console.error(result.error.message)
    }
  }

  const handleNotesChange = async (newNotes: string | null) => {
    const result = await updateInquiryNotes(inquiry.id, newNotes)
    if (result.error) {
      console.error(result.error.message)
    }
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
      <TabCell className="align-top pt-4 text-body-sm relative z-10">
        <EditablePrice initialPrice={inquiry.price} onSave={handlePriceChange} />
      </TabCell>
      <TabCell className="align-top pt-4 max-w-[200px] relative z-10">
        <EditableNotes initialNotes={inquiry.notes} onSave={handleNotesChange} />
      </TabCell>
      <TabCell className="align-top pt-4 text-right">
        <AttributionLine 
          email={inquiry.profiles?.role ? `Team ${inquiry.profiles.role}` : inquiry.created_by.slice(0, 8)} 
          date={inquiry.created_at}
          className="justify-end"
        />
      </TabCell>
    </TabRow>
  )
}
