import { createClient } from "@/lib/supabase/server"
import type { MissionRowType } from "@/lib/mission-category-review"
import type { Database } from "@/types/database"
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow"
import type { SourceWithProfile } from "@/components/organisms/SourceRow"
import type { SupplierWithStats } from "@/components/organisms/SupplierDirectory"

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
  | "catalog"
  | "inquiries"
  | "suppliers"
  | "products"
  | "sources"

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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const needsCatalog = activeSection === "catalog" || activeSection === "suppliers"
  const needsMissions = activeSection === "missions"
  const needsInquiries = activeSection === "inquiries" || activeSection === "suppliers"
  const needsSuppliers = activeSection === "suppliers"
  const needsProducts = activeSection === "products"
  const needsSources = activeSection === "sources"
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
    pending_classifications_count: 0,
    review_items: [],
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
