/* eslint-disable @typescript-eslint/no-explicit-any */
type SupplierRefsClient = {
  from: (table: string) => any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function getOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export async function refreshSupplierClassificationRefs(
  supabase: SupplierRefsClient,
  missionId: string,
) {
  const { data: suppliers, error: suppliersError } = await supabase
    .from('discovered_suppliers')
    .select('id, source_url, category_refs, normalized_category_refs')
    .eq('mission_id', missionId)

  if (suppliersError) throw new Error(suppliersError.message)

  const { data: categories, error: categoriesError } = await supabase
    .from('discovered_categories')
    .select(
      'id, source_url, brand_signal, product_signal, classification_status, classification_confidence',
    )
    .eq('mission_id', missionId)

  if (categoriesError) throw new Error(categoriesError.message)

  const categoryRows = (categories ?? []) as Array<{
    source_url: string
    brand_signal: string | null
    product_signal: string | null
    classification_status: 'auto_accepted' | 'needs_review' | 'reviewed'
  }>

  const updates = (suppliers ?? []).map((supplier: { id: string; source_url: string }) => {
    const supplierOrigin = getOrigin(supplier.source_url)
    const refs = new Set<string>()

    categoryRows
      .filter((category) => getOrigin(category.source_url) === supplierOrigin)
      .forEach((category) => {
        if (category.product_signal) refs.add(category.product_signal)
        if (
          category.brand_signal &&
          (category.classification_status === 'auto_accepted' ||
            category.classification_status === 'reviewed')
        ) {
          refs.add(category.brand_signal)
        }
      })

    return {
      id: supplier.id,
      normalized_category_refs: Array.from(refs),
    }
  })

  if (updates.length === 0) return 0

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('discovered_suppliers')
      .update({ normalized_category_refs: update.normalized_category_refs })
      .eq('id', update.id)

    if (updateError) throw new Error(updateError.message)
  }

  return updates.filter((update: { normalized_category_refs: string[] }) => update.normalized_category_refs.length > 0).length
}
