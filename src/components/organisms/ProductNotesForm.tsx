'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProductUpdateSchema, type ProductUpdateValues } from '@/lib/schemas/product'
import { updateProduct } from '@/actions/products'

interface ProductNotesFormProps {
  productId: string
  initialNotes: string
}

export function ProductNotesForm({ productId, initialNotes }: ProductNotesFormProps) {
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const form = useForm<ProductUpdateValues>({
    resolver: zodResolver(ProductUpdateSchema),
    defaultValues: { notes: initialNotes },
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
