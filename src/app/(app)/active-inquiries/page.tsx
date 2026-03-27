import { createClient } from "@/lib/supabase/server"
import { InquiryTable } from "@/components/organisms/InquiryTable"
import { DetailTemplate } from "@/components/templates/DetailTemplate"
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow"

export default async function ActiveInquiriesPage() {
  const supabase = await createClient()

  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("*, suppliers(name), products(notes)")
    .not("status", "in", "('decided', 'ghosted')")
    .order("created_at", { ascending: false })

  const typedInquiries = inquiries || []

  return (
    <DetailTemplate 
      title="Active Inquiries"
      breadcrumb={<span>Home</span>}
    >
      <div className="space-y-6">
        <InquiryTable
          inquiries={typedInquiries}
          showProductName={true}
        />
      </div>
    </DetailTemplate>
  )
}
