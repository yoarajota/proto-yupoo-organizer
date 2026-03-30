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
  emptyMessage?: string
}

export function InquiryTable({ inquiries, showProductName, className, emptyMessage }: InquiryTableProps) {
  if (inquiries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 border border-dashed border-border/60 bg-muted/5 animate-in fade-in zoom-in-95 duration-700">
        <p className="text-xs uppercase tracking-widest text-muted-foreground/60 italic font-medium">
          {emptyMessage || "Inventory is empty."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-foreground/10 hover:bg-transparent">
            {showProductName && <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Reference</TableHead>}
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Supplier</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Status</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Valuation</TableHead>
            <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground py-6">Annotations</TableHead>
            <TableHead className="text-right text-[10px] uppercase tracking-widest text-muted-foreground py-6">Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.map((inquiry, i) => (
            <InquiryRow 
              key={inquiry.id} 
              inquiry={inquiry} 
              showProductName={showProductName}
              productName={inquiry.products?.notes?.slice(0, 30)}
              className={cn("animate-in fade-in slide-in-from-bottom-2 duration-500")}
              style={{ animationDelay: `${i * 50}ms` } as any}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
