export type CatalogOption = {
  id: string
  name: string
  slug?: string
}

export type BrandCatalogOption = CatalogOption & {
  brand_aliases?: {
    id: string
    alias: string
  }[]
}

export function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
