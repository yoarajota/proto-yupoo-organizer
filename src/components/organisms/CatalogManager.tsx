"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ShieldCheck,
  ShieldOff,
  Tags,
} from "lucide-react"
import { createBrand, createBrandAlias, createProductType } from "@/actions/catalog"
import type { CatalogPaginationState } from "@/app/(app)/workspace/data"
import { SearchField } from "@/components/molecules/SearchField"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { BrandCatalogOption, CatalogOption } from "@/lib/catalog"
import { cn } from "@/lib/utils"

const DEFAULT_VISIBLE_ALIASES = 8

type CatalogManagerProps = {
  brands: BrandCatalogOption[]
  productTypes: CatalogOption[]
  isAdmin: boolean
  summary: {
    totalBrands: number
    totalAliases: number
    totalProductTypes: number
  }
  pagination: {
    brands: CatalogPaginationState
    productTypes: CatalogPaginationState
  }
  searchState: CatalogSearchState
}

export type CatalogSearchState = {
  brandQuery: string
  brandPage: number
  productTypeQuery: string
  productTypePage: number
}

export function CatalogManager({
  brands,
  productTypes,
  isAdmin,
  summary,
  pagination,
  searchState,
}: CatalogManagerProps) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <CatalogStatCard
          label="Brands"
          value={summary.totalBrands}
          helper="Canonical names used across supplier records."
        />
        <CatalogStatCard
          label="Aliases"
          value={summary.totalAliases}
          helper="Observed cover names mapped back to real brands."
        />
        <CatalogStatCard
          label="Product Types"
          value={summary.totalProductTypes}
          helper="Reusable categories for missions, products, and suppliers."
        />
      </section>

      <CatalogAccessCard isAdmin={isAdmin} />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <BrandCatalogPanel
          brands={brands}
          isAdmin={isAdmin}
          pagination={pagination.brands}
          searchState={searchState}
        />
        <CatalogPanel
          title="Product Types"
          description="Standardize the product taxonomy used by missions, photo uploads, and supplier coverage."
          items={productTypes}
          placeholder="e.g. Bags"
          submitLabel="Add Type"
          emptyState="No product types yet."
          isAdmin={isAdmin}
          pagination={pagination.productTypes}
          searchState={searchState}
          queryKey="productTypeQuery"
          pageKey="productTypePage"
          searchPlaceholder="Search product types"
          singularLabel="product type"
          pluralLabel="product types"
          onCreate={createProductType}
        />
      </div>
    </div>
  )
}

function CatalogStatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: number
  helper: string
}) {
  return (
    <Card className="rounded-none border-border/70 shadow-none">
      <CardHeader className="gap-2 p-4">
        <CardDescription className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
          {label}
        </CardDescription>
        <CardTitle className="text-3xl font-heading text-foreground">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function CatalogAccessCard({ isAdmin }: { isAdmin: boolean }) {
  const Icon = isAdmin ? ShieldCheck : ShieldOff

  return (
    <Card className="rounded-none border-border/70 bg-surface-container-low shadow-none">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center border border-border/70 bg-background text-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {isAdmin ? "Admin access enabled" : "Read-only catalog access"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "You can add brands, aliases, and product types. Searches and pages now load from the server."
                : "You can inspect the shared catalog, but only admins can add or edit taxonomy values."}
            </p>
          </div>
        </div>

        <Badge variant={isAdmin ? "outline" : "secondary"} className="rounded-none">
          {isAdmin ? "Can edit" : "View only"}
        </Badge>
      </CardContent>
    </Card>
  )
}

function BrandCatalogPanel({
  brands,
  isAdmin,
  pagination,
  searchState,
}: {
  brands: BrandCatalogOption[]
  isAdmin: boolean
  pagination: CatalogPaginationState
  searchState: CatalogSearchState
}) {
  return (
    <Card className="rounded-none border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="text-body-md">Brands</CardTitle>
        <CardDescription>
          Keep a clean list of canonical brand names and the disguised aliases
          suppliers use in albums and chats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <CatalogCreateForm
          placeholder="e.g. Prada"
          submitLabel="Add Brand"
          disabled={!isAdmin}
          helperText={
            isAdmin
              ? "Add the canonical brand once, then capture supplier aliases below."
              : "Brand management is limited to admins."
          }
          onCreate={createBrand}
        />

        <CatalogCollectionToolbar
          title="Brand registry"
          description="Search canonical names or aliases, then move through server-loaded pages."
          pagination={pagination}
          searchState={searchState}
          queryKey="brandQuery"
          pageKey="brandPage"
          searchPlaceholder="Search brands or aliases"
          singularLabel="brand"
          pluralLabel="brands"
        />

        {pagination.totalItems === 0 ? (
          pagination.query ? (
            <CatalogEmptyState
              title="No matching brands"
              description="Try a canonical brand name or a supplier alias."
            />
          ) : (
            <CatalogEmptyState
              title="No brands registered"
              description="Add the first canonical brand to start mapping supplier aliases."
            />
          )
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {brands.map((brand) => (
                <BrandRegistryCard
                  key={brand.id}
                  brand={brand}
                  disabled={!isAdmin}
                />
              ))}
            </div>
            <CatalogPaginationControls
              pagination={pagination}
              searchState={searchState}
              queryKey="brandQuery"
              pageKey="brandPage"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BrandRegistryCard({
  brand,
  disabled,
}: {
  brand: BrandCatalogOption
  disabled: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const aliases = brand.brand_aliases ?? []
  const primaryAlias = aliases[0]?.alias ?? null
  const hiddenAliasCount = Math.max(aliases.length - 1, 0)

  return (
    <section className="space-y-2 border border-border/70 bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {brand.name}
            </h3>
            <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {aliases.length}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {primaryAlias
              ? hiddenAliasCount > 0
                ? `${primaryAlias} +${hiddenAliasCount} more`
                : primaryAlias
              : "No aliases recorded yet."}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 rounded-none px-2 text-[10px] uppercase tracking-[0.18em]"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Less" : "More"}
        </Button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Tags className="h-3.5 w-3.5" />
            Alias mapping
          </div>
          {aliases.length > 0 ? (
            <AliasList aliases={aliases} />
          ) : null}
          <BrandAliasForm brandId={brand.id} disabled={disabled} />
        </div>
      ) : null}
    </section>
  )
}

function BrandAliasForm({
  brandId,
  disabled,
}: {
  brandId: string
  disabled: boolean
}) {
  const [alias, setAlias] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return

    setError(null)

    startTransition(async () => {
      const result = await createBrandAlias({ brand_id: brandId, alias })

      if (result.error) {
        setError(result.error.message)
        return
      }

      setAlias("")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          placeholder="Alias, e.g. PRA*DA*"
          disabled={disabled}
          aria-label="Brand alias"
        />
        <Button
          type="submit"
          disabled={disabled || isPending || alias.trim().length === 0}
          className="rounded-none"
        >
          {isPending ? "Adding..." : "Add Alias"}
        </Button>
      </div>
      {disabled ? (
        <p className="text-xs text-muted-foreground">
          Admin access is required to add aliases.
        </p>
      ) : null}
      {error ? <p className="text-label-xs text-destructive">{error}</p> : null}
    </form>
  )
}

type CatalogPanelProps = {
  title: string
  description: string
  items: CatalogOption[]
  placeholder: string
  submitLabel: string
  emptyState: string
  isAdmin: boolean
  pagination: CatalogPaginationState
  searchState: CatalogSearchState
  queryKey: string
  pageKey: string
  searchPlaceholder: string
  singularLabel: string
  pluralLabel: string
  onCreate: (values: { name: string }) => Promise<{
    data: unknown
    error: { message: string } | null
  }>
}

function CatalogPanel({
  title,
  description,
  items,
  placeholder,
  submitLabel,
  emptyState,
  isAdmin,
  pagination,
  searchState,
  queryKey,
  pageKey,
  searchPlaceholder,
  singularLabel,
  pluralLabel,
  onCreate,
}: CatalogPanelProps) {
  return (
    <Card className="rounded-none border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="text-body-md">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CatalogCreateForm
          placeholder={placeholder}
          submitLabel={submitLabel}
          disabled={!isAdmin}
          helperText={
            isAdmin
              ? "Use broad, reusable terms instead of supplier-specific wording."
              : "Only admins can extend the shared taxonomy."
          }
          onCreate={onCreate}
        />

        <CatalogCollectionToolbar
          title={title}
          description="Use search to narrow the server result set before changing pages."
          pagination={pagination}
          searchState={searchState}
          queryKey={queryKey}
          pageKey={pageKey}
          searchPlaceholder={searchPlaceholder}
          singularLabel={singularLabel}
          pluralLabel={pluralLabel}
        />

        {pagination.totalItems === 0 ? (
          pagination.query ? (
            <CatalogEmptyState
              title={`No matching ${pluralLabel}`}
              description="Try a broader search term."
            />
          ) : (
            <CatalogEmptyState
              title={emptyState}
              description="Once created, these values become available across the workspace."
            />
          )
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <Badge key={item.id} variant="outline" className="rounded-none">
                  {item.name}
                </Badge>
              ))}
            </div>

            <CatalogPaginationControls
              pagination={pagination}
              searchState={searchState}
              queryKey={queryKey}
              pageKey={pageKey}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CatalogCollectionToolbar({
  title,
  description,
  pagination,
  searchState,
  queryKey,
  pageKey,
  searchPlaceholder,
  singularLabel,
  pluralLabel,
}: {
  title: string
  description: string
  pagination: CatalogPaginationState
  searchState: CatalogSearchState
  queryKey: string
  pageKey: string
  searchPlaceholder: string
  singularLabel: string
  pluralLabel: string
}) {
  const label = pagination.totalItems === 1 ? singularLabel : pluralLabel

  return (
    <div className="space-y-3 border border-border/70 bg-surface-container-low p-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <CatalogSearchForm
        query={pagination.query}
        searchState={searchState}
        queryKey={queryKey}
        pageKey={pageKey}
        placeholder={searchPlaceholder}
      />

      <p className="text-xs text-muted-foreground">
        {pagination.query
          ? `${pagination.totalItems} ${label} match "${pagination.query}".`
          : `${pagination.totalItems} ${label} available.`}
      </p>
      <p className="text-xs text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages}
      </p>
    </div>
  )
}

function CatalogSearchForm({
  query,
  searchState,
  queryKey,
  pageKey,
  placeholder,
}: {
  query: string
  searchState: CatalogSearchState
  queryKey: string
  pageKey: string
  placeholder: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(query)

  useEffect(() => {
    setValue(query)
  }, [query])

  function navigate(nextQuery: string) {
    const searchParams = buildCatalogSearchParams(searchState)

    if (nextQuery.trim()) {
      searchParams.set(queryKey, nextQuery.trim())
    } else {
      searchParams.delete(queryKey)
    }

    searchParams.delete(pageKey)

    const target = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname

    startTransition(() => {
      router.push(target)
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(value)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <SearchField
        value={value}
        onChange={setValue}
        placeholder={placeholder}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="outline"
          className="rounded-none"
          disabled={isPending}
        >
          Apply
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-none"
          disabled={isPending || value.length === 0}
          onClick={() => {
            setValue("")
            navigate("")
          }}
        >
          Clear
        </Button>
      </div>
    </form>
  )
}

function CatalogPaginationControls({
  pagination,
  searchState,
  queryKey,
  pageKey,
}: {
  pagination: CatalogPaginationState
  searchState: CatalogSearchState
  queryKey: string
  pageKey: string
}) {
  if (pagination.totalPages <= 1) return null

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing page {pagination.page} of {pagination.totalPages}
      </p>
      <div className="flex gap-2">
        <PaginationLink
          page={pagination.page - 1}
          disabled={pagination.page <= 1}
          query={pagination.query}
          searchState={searchState}
          queryKey={queryKey}
          pageKey={pageKey}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </PaginationLink>
        <PaginationLink
          page={pagination.page + 1}
          disabled={pagination.page >= pagination.totalPages}
          query={pagination.query}
          searchState={searchState}
          queryKey={queryKey}
          pageKey={pageKey}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </PaginationLink>
      </div>
    </div>
  )
}

function PaginationLink({
  page,
  disabled,
  query,
  searchState,
  queryKey,
  pageKey,
  children,
}: {
  page: number
  disabled: boolean
  query: string
  searchState: CatalogSearchState
  queryKey: string
  pageKey: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = buildCatalogSearchParams(searchState)

  if (query) {
    searchParams.set(queryKey, query)
  } else {
    searchParams.delete(queryKey)
  }

  if (page > 1) {
    searchParams.set(pageKey, String(page))
  } else {
    searchParams.delete(pageKey)
  }

  const href = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname

  if (disabled) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: "outline" }),
          "rounded-none opacity-50",
        )}
        aria-disabled="true"
      >
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "outline" }), "rounded-none")}
    >
      {children}
    </Link>
  )
}

function CatalogCreateForm({
  placeholder,
  submitLabel,
  disabled,
  helperText,
  onCreate,
}: Pick<CatalogPanelProps, "placeholder" | "submitLabel" | "onCreate"> & {
  disabled: boolean
  helperText: string
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return

    setError(null)

    startTransition(async () => {
      const result = await onCreate({ name })

      if (result.error) {
        setError(result.error.message)
        return
      }

      setName("")
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={placeholder}
        />
        <Button
          type="submit"
          disabled={disabled || isPending || name.trim().length === 0}
          className="rounded-none"
        >
          {isPending ? "Adding..." : submitLabel}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{helperText}</p>
      {error ? <p className="text-label-xs text-destructive">{error}</p> : null}
    </form>
  )
}

function CatalogEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border border-dashed border-border/70 bg-surface-container-low px-4 py-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function buildCatalogSearchParams(searchState: CatalogSearchState) {
  const searchParams = new URLSearchParams()

  if (searchState.brandQuery) {
    searchParams.set("brandQuery", searchState.brandQuery)
  }

  if (searchState.brandPage > 1) {
    searchParams.set("brandPage", String(searchState.brandPage))
  }

  if (searchState.productTypeQuery) {
    searchParams.set("productTypeQuery", searchState.productTypeQuery)
  }

  if (searchState.productTypePage > 1) {
    searchParams.set("productTypePage", String(searchState.productTypePage))
  }

  return searchParams
}

function AliasList({
  aliases,
}: {
  aliases: {
    id: string
    alias: string
  }[]
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleAliases = expanded
    ? aliases
    : aliases.slice(0, DEFAULT_VISIBLE_ALIASES)
  const hiddenCount = Math.max(aliases.length - visibleAliases.length, 0)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {visibleAliases.map((alias) => (
          <Badge
            key={alias.id}
            variant="secondary"
            className="rounded-none"
          >
            {alias.alias}
          </Badge>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          className="h-8 rounded-none px-2 text-xs uppercase tracking-wide text-muted-foreground"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show fewer aliases
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show {hiddenCount} more aliases
            </>
          )}
        </Button>
      ) : null}
    </div>
  )
}
