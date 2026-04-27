import { createClient } from "@/lib/supabase/server"
import { UnifiedWorkspace } from "@/components/organisms/UnifiedWorkspace"
import type { Database } from "@/types/database"
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow"
import type { SourceWithProfile } from "@/components/organisms/SourceRow"
import type { SupplierWithStats } from "@/components/organisms/SupplierDirectory"
import type {
  MissionCategoryReviewItem,
  MissionRowType,
} from "@/components/organisms/MissionsTable"

type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type PhotoHashRow = Database["public"]["Tables"]["photo_hashes"]["Row"]

type ProductForCard = ProductRow & {
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
  ] = await Promise.all([
    supabase
      .from("inquiries")
      .select("*, suppliers(name), products(notes, photo_hashes(storage_path, alt_text))")
      .not("status", "in", "('decided', 'ghosted')")
      .order("created_at", { ascending: false }),
    supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
    supabase.from("inquiries").select("supplier_id, price").not("price", "is", null),
    supabase
      .from("inquiries")
      .select("supplier_id, status")
      .in("status", ["sent", "price_received", "negotiating"]),
    supabase
      .from("products")
      .select("*, photo_hashes(*, similarity_matches!source_photo_hash_id(is_dismissed))")
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
        "mission_id, source_category_id, display_label, canonical_brand, canonical_product_type, classification_confidence, classification_method, classification_status, evidence",
      )
      .eq("classification_status", "needs_review"),
  ])

  const inquiryRows = (inquiries ?? []) as InquiryWithSupplier[]

  const supplierRows =
    (suppliers ?? []) as Database["public"]["Tables"]["suppliers"]["Row"][]
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
  const reviewRows = (pendingCategoryReviews ?? []) as Array<{
    mission_id: string
    source_category_id: string
    display_label: string
    canonical_brand: string | null
    canonical_product_type: string | null
    classification_confidence: number | null
    classification_method: string | null
    classification_status: string
    evidence: Record<string, unknown> | null
  }>
  const groupedReviewRows = reviewRows.reduce<Record<string, MissionCategoryReviewItem[]>>(
    (accumulator, row) => {
      const evidence = row.evidence ?? {}
      const groupKey = [
        row.mission_id,
        String(evidence.normalized_label ?? row.display_label),
        row.canonical_brand ?? "",
        row.canonical_product_type ?? "",
        String(evidence.decision_reason ?? ""),
      ].join("::")

      accumulator[row.mission_id] ??= []

      const existingGroup = accumulator[row.mission_id]?.find((item) => item.group_key === groupKey)
      if (existingGroup) {
        existingGroup.occurrence_count += 1
        existingGroup.category_ids.push(row.source_category_id)
        return accumulator
      }

      accumulator[row.mission_id]?.push({
        id: row.source_category_id,
        mission_id: row.mission_id,
        group_key: groupKey,
        raw_label: String(evidence.raw_label ?? row.display_label),
        normalized_label: String(evidence.normalized_label ?? row.display_label),
        display_label: row.display_label,
        brand_signal: row.canonical_brand,
        product_signal: row.canonical_product_type,
        classification_confidence: row.classification_confidence,
        classification_method: row.classification_method,
        classification_status: row.classification_status,
        decision_reason: String(evidence.decision_reason ?? "needs_review"),
        decision_reason_text: String(
          evidence.decision_reason_text ?? "This label still needs manual review before matching can run.",
        ),
        occurrence_count: 1,
        category_ids: [row.source_category_id],
      })
      return accumulator
    },
    {},
  )

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
    />
  )
}
