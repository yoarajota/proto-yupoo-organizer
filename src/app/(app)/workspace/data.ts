import { createClient } from "@/lib/supabase/server"
import type { MissionRowType } from "@/lib/mission-category-review"
import {
  attachSuggestedReviewAliases,
  buildKnownAliasForms,
  groupMissionCategoryReviewItems,
  toPendingCategoryReviewRows,
  toReviewDecisions,
} from "@/lib/mission-category-review"
import type { Database } from "@/types/database"
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow"
import type { SourceWithProfile } from "@/components/organisms/SourceRow"
import type { SupplierWithStats } from "@/components/organisms/SupplierDirectory"
import { PREVIEW_USER_ID, isUiPreviewMode } from "@/lib/preview"

type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type PhotoHashRow = Database["public"]["Tables"]["photo_hashes"]["Row"]
type BrandRow = Database["public"]["Tables"]["brands"]["Row"]
type BrandAliasRow = Database["public"]["Tables"]["brand_aliases"]["Row"]
type ProductTypeRow = Database["public"]["Tables"]["product_types"]["Row"]

const BRAND_PAGE_SIZE = 12
const PRODUCT_TYPE_PAGE_SIZE = 24

type SearchParamValue = string | string[] | undefined

export type ProductForCard = ProductRow & {
  brands?: { name: string } | null
  product_types?: { name: string } | null
  photo_hashes: (PhotoHashRow & {
    similarity_matches?: { is_dismissed: boolean }[]
  })[]
}

export interface CatalogPaginationState {
  query: string
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface WorkspaceData {
  isAdmin: boolean
  missions: MissionRowType[]
  inquiries: InquiryWithSupplier[]
  suppliers: SupplierWithStats[]
  products: ProductForCard[]
  sources: SourceWithProfile[]
  brands: {
    id: string
    name: string
    slug: string
    brand_aliases: {
      id: string
      alias: string
    }[]
  }[]
  productTypes: {
    id: string
    name: string
    slug: string
  }[]
  catalogSummary: {
    totalBrands: number
    totalAliases: number
    totalProductTypes: number
  }
  catalogPagination: {
    brands: CatalogPaginationState
    productTypes: CatalogPaginationState
  }
}

type WorkspaceSearchParams = {
  brandPage?: SearchParamValue
  brandQuery?: SearchParamValue
  productTypePage?: SearchParamValue
  productTypeQuery?: SearchParamValue
}

type WorkspaceDataSection =
  | "missions"
  | "missionCreate"
  | "review"
  | "catalog"
  | "inquiries"
  | "suppliers"
  | "products"
  | "sources"

const previewNow = "2026-05-18T13:30:00.000Z"

function getPreviewWorkspaceData(): WorkspaceData {
  const brands = [
    { id: "brand-prada", name: "Prada", slug: "prada", brand_aliases: [{ id: "alias-pda", alias: "PDA" }] },
    { id: "brand-lv", name: "Louis Vuitton", slug: "louis-vuitton", brand_aliases: [{ id: "alias-lv", alias: "LV Maison" }] },
    { id: "brand-miu", name: "Miu Miu", slug: "miu-miu", brand_aliases: [{ id: "alias-mm", alias: "MM Studio" }] },
    { id: "brand-loewe", name: "Loewe", slug: "loewe", brand_aliases: [] },
  ]
  const productTypes = [
    { id: "type-bags", name: "Bags", slug: "bags" },
    { id: "type-footwear", name: "Footwear", slug: "footwear" },
    { id: "type-accessories", name: "Accessories", slug: "accessories" },
    { id: "type-outerwear", name: "Outerwear", slug: "outerwear" },
  ]
  const suppliers: SupplierWithStats[] = [
    {
      id: "supplier-atelier-01",
      name: "West42 Atelier",
      yupoo_url: "https://west42.x.yupoo.com",
      whatsapp_contact: "+86 138 0000 0142",
      trust_notes: "Fast album updates, consistent QC photos, strong leather goods coverage.",
      red_flag_source: null,
      is_flagged: false,
      negotiation_opening_price: 168,
      negotiation_final_price: 142,
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-14T09:00:00.000Z",
      updated_at: previewNow,
      supplier_brands: [
        { brand_id: "brand-prada", brand: { name: "Prada" } },
        { brand_id: "brand-miu", brand: { name: "Miu Miu" } },
      ],
      supplier_product_types: [{ product_type_id: "type-bags", product_type: { name: "Bags" } }],
      priceRange: { min: 128, max: 188 },
      activeInquiryCount: 3,
    },
    {
      id: "supplier-atelier-02",
      name: "Pearl Market Desk",
      yupoo_url: "https://pearlmarket.example.com",
      whatsapp_contact: "+86 139 0000 2231",
      trust_notes: "Best for accessories and small leather goods; ask for batch photos before payment.",
      red_flag_source: null,
      is_flagged: false,
      negotiation_opening_price: 92,
      negotiation_final_price: 78,
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-12T11:20:00.000Z",
      updated_at: previewNow,
      supplier_brands: [
        { brand_id: "brand-lv", brand: { name: "Louis Vuitton" } },
        { brand_id: "brand-loewe", brand: { name: "Loewe" } },
      ],
      supplier_product_types: [{ product_type_id: "type-accessories", product_type: { name: "Accessories" } }],
      priceRange: { min: 68, max: 126 },
      activeInquiryCount: 1,
    },
    {
      id: "supplier-atelier-03",
      name: "North Gate Archive",
      yupoo_url: "https://northgate.example.com",
      whatsapp_contact: "+86 137 0000 7780",
      trust_notes: "Broad source list but inconsistent response time.",
      red_flag_source: "Two delayed shipment notes in April.",
      is_flagged: true,
      negotiation_opening_price: 210,
      negotiation_final_price: null,
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-08T15:00:00.000Z",
      updated_at: previewNow,
      supplier_brands: [{ brand_id: "brand-prada", brand: { name: "Prada" } }],
      supplier_product_types: [{ product_type_id: "type-footwear", product_type: { name: "Footwear" } }],
      priceRange: { min: 156, max: 246 },
      activeInquiryCount: 0,
    },
  ]
  const products: ProductForCard[] = [
    {
      id: "product-city-tote",
      notes: "City tote reference with contrast stitching",
      brand_id: "brand-prada",
      product_type_id: "type-bags",
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-17T13:00:00.000Z",
      updated_at: previewNow,
      brands: { name: "Prada" },
      product_types: { name: "Bags" },
      photo_hashes: [],
    },
    {
      id: "product-mesh-runner",
      notes: "Mesh runner, smoke grey upper",
      brand_id: "brand-miu",
      product_type_id: "type-footwear",
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-16T10:30:00.000Z",
      updated_at: previewNow,
      brands: { name: "Miu Miu" },
      product_types: { name: "Footwear" },
      photo_hashes: [],
    },
    {
      id: "product-chain-wallet",
      notes: "Compact chain wallet with monogram emboss",
      brand_id: "brand-lv",
      product_type_id: "type-accessories",
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-15T16:15:00.000Z",
      updated_at: previewNow,
      brands: { name: "Louis Vuitton" },
      product_types: { name: "Accessories" },
      photo_hashes: [],
    },
  ]
  const inquiries: InquiryWithSupplier[] = [
    {
      id: "inquiry-01",
      product_id: "product-city-tote",
      supplier_id: "supplier-atelier-01",
      status: "negotiating",
      price: 142,
      notes: "Waiting on interior stamp and hardware close-up.",
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-17T14:00:00.000Z",
      updated_at: previewNow,
      suppliers: { name: "West42 Atelier" },
      profiles: { id: PREVIEW_USER_ID, role: "admin" },
      products: { notes: "City tote reference", photo_hashes: [] },
    },
    {
      id: "inquiry-02",
      product_id: "product-chain-wallet",
      supplier_id: "supplier-atelier-02",
      status: "price_received",
      price: 78,
      notes: "Ask for batch quantity and shipping line.",
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-16T12:30:00.000Z",
      updated_at: previewNow,
      suppliers: { name: "Pearl Market Desk" },
      profiles: { id: PREVIEW_USER_ID, role: "admin" },
      products: { notes: "Compact chain wallet", photo_hashes: [] },
    },
  ]
  const sources: SourceWithProfile[] = [
    {
      id: "source-01",
      url: "https://west42.x.yupoo.com/categories",
      platform: "other",
      brands: ["Prada", "Miu Miu"],
      notes: "Strong category hygiene; inspect seasonal album names weekly.",
      is_active: true,
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-13T08:40:00.000Z",
      updated_at: previewNow,
      profiles: { role: "admin" },
    },
    {
      id: "source-02",
      url: "https://discord.com/channels/sourcing/leads",
      platform: "discord",
      brands: ["Louis Vuitton", "Loewe"],
      notes: "Good chatter for new drops, weaker supplier provenance.",
      is_active: true,
      created_by: PREVIEW_USER_ID,
      created_at: "2026-05-11T18:10:00.000Z",
      updated_at: previewNow,
      profiles: { role: "member" },
    },
  ]
  const missions = [
    {
      id: "mission-01",
      product_intent: "Find Prada leather tote suppliers with QC evidence",
      seed_url: "https://west42.x.yupoo.com/albums",
      destination_context: "Buyer wants neutral leather goods under $180",
      status: "scanning",
      current_stage: "Scraping categories",
      queued_at: "2026-05-18T12:55:00.000Z",
      running_at: "2026-05-18T13:02:00.000Z",
      failed_at: null,
      attempt_count: 1,
      last_error_message: null,
      last_error_code: null,
      created_at: "2026-05-18T12:45:00.000Z",
      pending_classifications_count: 8,
      review_items: [],
    },
    {
      id: "mission-02",
      product_intent: "Compare LV compact wallet sources",
      seed_url: "https://pearlmarket.example.com/categories",
      destination_context: "Prioritize low defect reports and quick replies",
      status: "completed",
      current_stage: "Suggestions ready",
      queued_at: "2026-05-17T09:00:00.000Z",
      running_at: "2026-05-17T09:05:00.000Z",
      failed_at: null,
      attempt_count: 1,
      last_error_message: null,
      last_error_code: null,
      created_at: "2026-05-17T08:55:00.000Z",
      pending_classifications_count: 0,
      review_items: [],
    },
    {
      id: "mission-03",
      product_intent: "Refresh footwear supplier lead list",
      seed_url: "https://northgate.example.com/albums",
      destination_context: "Flag low confidence sources for manual review",
      status: "failed_retrying",
      current_stage: "Retry scheduled",
      queued_at: "2026-05-16T16:00:00.000Z",
      running_at: "2026-05-16T16:08:00.000Z",
      failed_at: "2026-05-16T16:12:00.000Z",
      attempt_count: 2,
      last_error_message: "Source returned an empty album index.",
      last_error_code: "EMPTY_INDEX",
      created_at: "2026-05-16T15:45:00.000Z",
      pending_classifications_count: 0,
      review_items: [],
    },
  ] as MissionRowType[]

  return {
    isAdmin: true,
    missions,
    inquiries,
    suppliers,
    products,
    sources,
    brands,
    productTypes,
    catalogSummary: {
      totalBrands: 42,
      totalAliases: 118,
      totalProductTypes: 16,
    },
    catalogPagination: {
      brands: { query: "", page: 1, pageSize: BRAND_PAGE_SIZE, totalItems: 42, totalPages: 4 },
      productTypes: { query: "", page: 1, pageSize: PRODUCT_TYPE_PAGE_SIZE, totalItems: 16, totalPages: 1 },
    },
  }
}

function getSingleSearchParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

function parsePage(value: SearchParamValue) {
  const raw = Number.parseInt(getSingleSearchParam(value), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

function parseQuery(value: SearchParamValue) {
  return getSingleSearchParam(value).trim()
}

function getTotalPages(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

function clampPage(page: number, totalItems: number, pageSize: number) {
  return Math.min(page, getTotalPages(totalItems, pageSize))
}

async function getBrandPageData(
  searchParams: WorkspaceSearchParams,
) {
  const supabase = await createClient()
  const brandQuery = parseQuery(searchParams.brandQuery)
  const requestedBrandPage = parsePage(searchParams.brandPage)

  const [brandCountResult, aliasCountResult] = await Promise.all([
    supabase.from("brands").select("id", { count: "exact", head: true }),
    supabase.from("brand_aliases").select("id", { count: "exact", head: true }),
  ])
  const totalBrands = brandCountResult.count ?? 0
  const totalAliases = aliasCountResult.count ?? 0

  let filteredBrandIds: string[] | null = null

  if (brandQuery) {
    const [brandMatches, aliasMatches] = await Promise.all([
      supabase
        .from("brands")
        .select("id")
        .ilike("name", `%${brandQuery}%`),
      supabase
        .from("brand_aliases")
        .select("brand_id")
        .ilike("alias", `%${brandQuery}%`),
    ])

    const matchedIds = new Set<string>()

    ;((brandMatches.data ?? []) as Pick<BrandRow, "id">[]).forEach((brand) => {
      matchedIds.add(brand.id)
    })

    ;((aliasMatches.data ?? []) as Pick<BrandAliasRow, "brand_id">[]).forEach((alias) => {
      if (alias.brand_id) matchedIds.add(alias.brand_id)
    })

    filteredBrandIds = Array.from(matchedIds)
  }

  const filteredBrandCount =
    filteredBrandIds === null ? totalBrands : filteredBrandIds.length
  const brandPage = clampPage(
    requestedBrandPage,
    filteredBrandCount,
    BRAND_PAGE_SIZE,
  )

  let brands: WorkspaceData["brands"] = []

  if (filteredBrandCount > 0) {
    let query = supabase
      .from("brands")
      .select("id, name, slug, brand_aliases(id, alias)")
      .order("name")
      .range(
        (brandPage - 1) * BRAND_PAGE_SIZE,
        brandPage * BRAND_PAGE_SIZE - 1,
      )

    if (filteredBrandIds !== null) {
      query = query.in("id", filteredBrandIds)
    }

    const { data } = await query
    brands = data ?? []
  }

  return {
    brands,
    summary: {
      totalBrands,
      totalAliases,
    },
    pagination: {
      query: brandQuery,
      page: brandPage,
      pageSize: BRAND_PAGE_SIZE,
      totalItems: filteredBrandCount,
      totalPages: getTotalPages(filteredBrandCount, BRAND_PAGE_SIZE),
    },
  }
}

async function getProductTypePageData(
  searchParams: WorkspaceSearchParams,
) {
  const supabase = await createClient()
  const productTypeQuery = parseQuery(searchParams.productTypeQuery)
  const requestedPage = parsePage(searchParams.productTypePage)

  const baseCountQuery = supabase
    .from("product_types")
    .select("id", { count: "exact", head: true })

  const filteredCountQuery = productTypeQuery
    ? supabase
        .from("product_types")
        .select("id", { count: "exact", head: true })
        .ilike("name", `%${productTypeQuery}%`)
    : baseCountQuery

  const [totalProductTypesResult, filteredProductTypesResult] =
    await Promise.all([baseCountQuery, filteredCountQuery])
  const totalProductTypes = totalProductTypesResult.count ?? 0
  const filteredProductTypes = filteredProductTypesResult.count ?? 0

  const productTypePage = clampPage(
    requestedPage,
    filteredProductTypes,
    PRODUCT_TYPE_PAGE_SIZE,
  )

  const productTypeQueryBuilder = supabase
    .from("product_types")
    .select("id, name, slug")
    .order("name")
    .range(
      (productTypePage - 1) * PRODUCT_TYPE_PAGE_SIZE,
      productTypePage * PRODUCT_TYPE_PAGE_SIZE - 1,
    )

  const { data: productTypes } = productTypeQuery
    ? await productTypeQueryBuilder.ilike("name", `%${productTypeQuery}%`)
    : await productTypeQueryBuilder

  return {
    productTypes: (productTypes ?? []) as Pick<
      ProductTypeRow,
      "id" | "name" | "slug"
    >[],
    summary: {
      totalProductTypes,
    },
    pagination: {
      query: productTypeQuery,
      page: productTypePage,
      pageSize: PRODUCT_TYPE_PAGE_SIZE,
      totalItems: filteredProductTypes,
      totalPages: getTotalPages(filteredProductTypes, PRODUCT_TYPE_PAGE_SIZE),
    },
  }
}

export async function getWorkspaceData(
  searchParams: WorkspaceSearchParams = {},
  activeSection: WorkspaceDataSection = "missions",
): Promise<WorkspaceData> {
  if (isUiPreviewMode()) {
    return getPreviewWorkspaceData()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const needsCatalog =
    activeSection === "catalog" ||
    activeSection === "suppliers" ||
    activeSection === "missionCreate" ||
    activeSection === "review"
  const needsMissions = activeSection === "missions" || activeSection === "review"
  const needsInquiries =
    activeSection === "inquiries" ||
    activeSection === "suppliers" ||
    activeSection === "review"
  const needsSuppliers =
    activeSection === "suppliers" ||
    activeSection === "sources" ||
    activeSection === "review"
  const needsProducts = activeSection === "products" || activeSection === "review"
  const needsSources =
    activeSection === "sources" ||
    activeSection === "suppliers" ||
    activeSection === "missionCreate" ||
    activeSection === "review"
  const emptyCatalogPagination: CatalogPaginationState = {
    query: "",
    page: 1,
    pageSize: 1,
    totalItems: 0,
    totalPages: 1,
  }

  const [
    { data: profile },
    { data: inquiries },
    { data: suppliers },
    { data: inquiriesWithPrice },
    { data: activeInquiries },
    { data: products },
    { data: sources },
    { data: missions },
    brandPageData,
    productTypePageData,
  ] = await Promise.all([
    user
      ? supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    needsInquiries
      ? supabase
      .from("inquiries")
      .select("*, suppliers(name), products(notes, photo_hashes(storage_path, alt_text))")
      .not("status", "in", "('decided', 'ghosted')")
      .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    needsSuppliers
      ? supabase
      .from("suppliers")
      .select("*, supplier_brands(brand_id, brand:brands(name)), supplier_product_types(product_type_id, product_type:product_types(name))")
      .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    needsSuppliers
      ? supabase.from("inquiries").select("supplier_id, price").not("price", "is", null)
      : Promise.resolve({ data: [] }),
    needsSuppliers
      ? supabase
      .from("inquiries")
      .select("supplier_id, status")
      .in("status", ["sent", "price_received", "negotiating"])
      : Promise.resolve({ data: [] }),
    needsProducts
      ? supabase
      .from("products")
      .select("*, brands(name), product_types(name), photo_hashes(*, similarity_matches!source_photo_hash_id(is_dismissed))")
      .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    needsSources
      ? supabase
      .from("sources")
      .select("*, profiles(role)")
      .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    needsMissions
      ? supabase
      .from("sourcing_missions")
      .select("id, product_intent, seed_url, destination_context, status, current_stage, queued_at, running_at, failed_at, attempt_count, last_error_message, last_error_code, created_at")
      .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    needsCatalog
      ? getBrandPageData(searchParams)
      : Promise.resolve({
          brands: [],
          summary: { totalBrands: 0, totalAliases: 0 },
          pagination: emptyCatalogPagination,
        }),
    needsCatalog
      ? getProductTypePageData(searchParams)
      : Promise.resolve({
          productTypes: [],
          summary: { totalProductTypes: 0 },
          pagination: emptyCatalogPagination,
        }),
  ])

  const inquiryRows = (inquiries ?? []) as InquiryWithSupplier[]
  const supplierRows = (suppliers ?? []) as SupplierWithStats[]
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

  const missionIdList = ((missions ?? []) as Array<{ id: string }>).map((mission) => mission.id)
  const reviewGroupsByMission: Record<string, MissionRowType['review_items']> = {}
  const pendingCountByMission: Record<string, number> = {}

  if (activeSection === "review" && missionIdList.length > 0) {
    const [{ data: pendingCategories }, { data: reviewedClassifications }] = await Promise.all([
      supabase
        .from("discovered_categories")
        .select("id, mission_id, raw_label, normalized_label, brand_signal, product_signal, classification_confidence, classification_method, classification_status, preview_image_urls, source_url")
        .in("mission_id", missionIdList)
        .eq("classification_status", "needs_review"),
      supabase
        .from("mission_category_classifications")
        .select("mission_id, canonical_brand, evidence")
        .in("mission_id", missionIdList)
        .eq("classification_status", "reviewed"),
    ])

    const knownAliasForms = buildKnownAliasForms(
      (brandPageData.brands ?? []) as Array<{
        name: string
        slug: string
        brand_aliases: Array<{ alias: string }>
      }>,
    )
    const grouped = groupMissionCategoryReviewItems(
      toPendingCategoryReviewRows(
        ((pendingCategories ?? []) as Parameters<typeof toPendingCategoryReviewRows>[0]),
      ),
    )
    const reviewedByMission = new Map<string, Array<{ canonical_brand: string | null; evidence: unknown }>>()
    ;((reviewedClassifications ?? []) as Array<{ mission_id: string; canonical_brand: string | null; evidence: unknown }>).forEach((row) => {
      reviewedByMission.set(row.mission_id, [...(reviewedByMission.get(row.mission_id) ?? []), row])
    })

    Object.entries(grouped).forEach(([missionId, items]) => {
      reviewGroupsByMission[missionId] = attachSuggestedReviewAliases(
        items,
        toReviewDecisions(reviewedByMission.get(missionId) ?? []),
        knownAliasForms,
      )
      pendingCountByMission[missionId] = items.reduce((total, item) => total + item.occurrence_count, 0)
    })
  }

  const missionRows = ((missions ?? []) as Array<{
    id: string
    product_intent: string
    seed_url: string
    destination_context: string | null
    status: string
    current_stage: string | null
    queued_at: string | null
    running_at: string | null
    failed_at: string | null
    attempt_count: number
    last_error_message: string | null
    last_error_code: string | null
    created_at: string
  }>).map((mission) => ({
    ...mission,
    pending_classifications_count: pendingCountByMission[mission.id] ?? 0,
    review_items: reviewGroupsByMission[mission.id] ?? [],
  })) as MissionRowType[]

  return {
    isAdmin: profile?.role === "admin",
    missions: missionRows,
    inquiries: inquiryRows,
    suppliers: supplierStats,
    products: (products ?? []) as ProductForCard[],
    sources: (sources ?? []) as SourceWithProfile[],
    brands: brandPageData.brands,
    productTypes: productTypePageData.productTypes,
    catalogSummary: {
      totalBrands: brandPageData.summary.totalBrands,
      totalAliases: brandPageData.summary.totalAliases,
      totalProductTypes: productTypePageData.summary.totalProductTypes,
    },
    catalogPagination: {
      brands: brandPageData.pagination,
      productTypes: productTypePageData.pagination,
    },
  }
}
