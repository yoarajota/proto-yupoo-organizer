import { createClient } from "@/lib/supabase/server"
import { groupMissionCategoryReviewItems, type MissionRowType } from "@/lib/mission-category-review"
import { UnifiedWorkspace } from "@/components/organisms/UnifiedWorkspace"
import type { Database } from "@/types/database"
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow"
import type { SourceWithProfile } from "@/components/organisms/SourceRow"
import type { SupplierWithStats } from "@/components/organisms/SupplierDirectory"

type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type PhotoHashRow = Database["public"]["Tables"]["photo_hashes"]["Row"]

type ProductForCard = ProductRow & {
  brands?: { name: string } | null
  product_types?: { name: string } | null
  photo_hashes: (PhotoHashRow & {
    similarity_matches?: { is_dismissed: boolean }[]
  })[]
}

export default async function ActiveInquiriesPage() {
  const supabase = await createClient()

  const [
    { data: inquiries },
    { data: suppliers },
    { data: inquiriesWithPrice },
    { data: activeInquiries },
    { data: products },
    { data: sources },
    { data: missions },
    { data: pendingCategoryReviews },
    { data: brands },
    { data: productTypes },
  ] = await Promise.all([
    supabase
      .from("inquiries")
      .select("*, suppliers(name), products(notes, photo_hashes(storage_path, alt_text))")
      .not("status", "in", "('decided', 'ghosted')")
      .order("created_at", { ascending: false }),
    supabase
      .from("suppliers")
      .select("*, supplier_brands(brand_id, brand:brands(name)), supplier_product_types(product_type_id, product_type:product_types(name))")
      .order("created_at", { ascending: false }),
    supabase.from("inquiries").select("supplier_id, price").not("price", "is", null),
    supabase
      .from("inquiries")
      .select("supplier_id, status")
      .in("status", ["sent", "price_received", "negotiating"]),
    supabase
      .from("products")
      .select("*, brands(name), product_types(name), photo_hashes(*, similarity_matches!source_photo_hash_id(is_dismissed))")
      .order("created_at", { ascending: false }),
    supabase
      .from("sources")
      .select("*, profiles(role)")
      .order("created_at", { ascending: false }),
    supabase
      .from("sourcing_missions")
      .select("id, product_intent, seed_url, destination_context, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("mission_category_classifications")
      .select(
        "mission_id, source_category_id, display_label, canonical_brand, canonical_product_type, classification_confidence, classification_method, classification_status, evidence, source_category:discovered_categories!mission_category_classifications_source_category_id_fkey(preview_image_urls, source_url)",
      )
      .eq("classification_status", "needs_review"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("product_types").select("id, name").order("name"),
  ])

  const inquiryRows = (inquiries ?? []) as InquiryWithSupplier[]

  const supplierRows =
    (suppliers ?? []) as SupplierWithStats[]
  const priceRows = (inquiriesWithPrice ?? []) as {
    supplier_id: string | null
    price: number | null
  }[]
  const activeRows = (activeInquiries ?? []) as { supplier_id: string | null }[]

  const supplierStats: SupplierWithStats[] = supplierRows.map((supplier) => {
    const supplierInquiries = priceRows.filter(
      (row) => row && row.supplier_id === supplier.id && row.price !== null,
    )

    const prices = supplierInquiries.map((row) => row.price as number)
    const activeCount = activeRows.filter(
      (row) => row && row.supplier_id === supplier.id,
    ).length

    return {
      ...supplier,
      priceRange:
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : undefined,
      activeInquiryCount: activeCount,
    }
  })

  const productRows = (products ?? []) as ProductForCard[]
  const sourceRows = (sources ?? []) as SourceWithProfile[]
  const reviewRows = (pendingCategoryReviews ?? []) as Parameters<
    typeof groupMissionCategoryReviewItems
  >[0]
  const groupedReviewRows = groupMissionCategoryReviewItems(reviewRows)

  const missionRows = ((missions ?? []) as Array<{
    id: string
    product_intent: string
    seed_url: string
    destination_context: string | null
    status: string
    created_at: string
  }>).map((mission) => ({
    ...mission,
    pending_classifications_count: groupedReviewRows[mission.id]?.length ?? 0,
    review_items: groupedReviewRows[mission.id] ?? [],
  })) as MissionRowType[]

  return (
    <UnifiedWorkspace
      missions={missionRows}
      inquiries={inquiryRows}
      suppliers={supplierStats}
      products={productRows}
      sources={sourceRows}
      brands={brands ?? []}
      productTypes={productTypes ?? []}
    />
  )
}
