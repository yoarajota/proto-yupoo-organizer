export type SupplierBrandLink = {
  brand_id: string
  brand?: { name: string } | null
}

export type SupplierProductTypeLink = {
  product_type_id: string
  product_type?: { name: string } | null
}

export function getSupplierBrandNames(supplier: {
  supplier_brands?: SupplierBrandLink[] | null
}) {
  return (supplier.supplier_brands ?? [])
    .map((link) => link.brand?.name)
    .filter((name): name is string => Boolean(name))
}

export function getSupplierProductTypeNames(supplier: {
  supplier_product_types?: SupplierProductTypeLink[] | null
}) {
  return (supplier.supplier_product_types ?? [])
    .map((link) => link.product_type?.name)
    .filter((name): name is string => Boolean(name))
}
