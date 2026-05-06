'use client'

import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProductUpdateSchema, type ProductUpdateValues } from '@/lib/schemas/product'
import { updateProduct } from '@/actions/products'
import { CatalogAutocomplete } from '@/components/molecules/CatalogAutocomplete'
import type { CatalogOption } from '@/lib/catalog'

interface ProductNotesFormProps {
  productId: string
  initialNotes: string
  initialBrandId?: string | null
  initialProductTypeId?: string | null
  brands?: CatalogOption[]
  productTypes?: CatalogOption[]
}

export function ProductNotesForm({
  productId,
  initialNotes,
  initialBrandId = null,
  initialProductTypeId = null,
  brands = [],
  productTypes = [],
}: ProductNotesFormProps) {
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const form = useForm<ProductUpdateValues>({
    resolver: zodResolver(ProductUpdateSchema),
    defaultValues: {
      notes: initialNotes,
      brand_id: initialBrandId,
      product_type_id: initialProductTypeId,
    },
  })

  function onSubmit(data: ProductUpdateValues) {
    setSaveError(null)
    startTransition(async () => {
      const result = await updateProduct(productId, data)
      if (result.error) setSaveError(result.error.message)
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          name="brand_id"
          control={form.control}
          render={({ field }) => (
            <CatalogAutocomplete
              label="Brand"
              options={brands}
              value={field.value ?? ''}
              onChange={(value) => field.onChange(value || null)}
              placeholder="Search brands"
              emptyMessage="No brands registered."
            />
          )}
        />

        <Controller
          name="product_type_id"
          control={form.control}
          render={({ field }) => (
            <CatalogAutocomplete
              label="Product Type"
              options={productTypes}
              value={field.value ?? ''}
              onChange={(value) => field.onChange(value || null)}
              placeholder="Search product types"
              emptyMessage="No product types registered."
            />
          )}
        />
      </div>

      <label className="text-label-sm text-muted-foreground block">Notes</label>
      <textarea
        {...form.register('notes')}
        className="w-full rounded-md border border-border bg-surface-container-lowest p-2 text-body-sm text-foreground resize-none"
        rows={4}
        placeholder="Add notes about this product…"
      />
      {saveError && <p className="text-label-xs text-error">{saveError}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="text-body-sm font-medium text-primary disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
