"use client"

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InquiryRow, type InquiryWithSupplier } from "./InquiryRow"
import { cn } from "@/lib/utils"

interface InquiryTableProps {
  inquiries: InquiryWithSupplier[]
  showProductName?: boolean
  className?: string
}

export function InquiryTable({ inquiries, showProductName, className }: InquiryTableProps) {
  if (inquiries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg bg-muted/30">
        <p className="text-body-sm text-muted-foreground">No inquiries found yet.</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow className="h-[48px] bg-muted/50">
            {showProductName && <TableHead className="w-[180px] text-label-md">Product</TableHead>}
            <TableHead className="w-[200px] text-label-md">Supplier</TableHead>
            <TableHead className="w-[160px] text-label-md">Status</TableHead>
            <TableHead className="w-[100px] text-label-md">Best Price</TableHead>
            <TableHead className="text-label-md">Notes</TableHead>
            <TableHead className="text-right text-label-md">Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.map((inquiry) => (
            <InquiryRow 
              key={inquiry.id} 
              inquiry={inquiry} 
              showProductName={showProductName}
              productName={inquiry.products?.notes?.slice(0, 30)} // Simplified name for now
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
