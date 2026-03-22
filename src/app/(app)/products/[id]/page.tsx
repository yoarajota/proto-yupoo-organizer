import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DetailTemplate } from '@/components/templates/DetailTemplate'
import { PhotoThumb } from '@/components/atoms/PhotoThumb'
import { PhotoUploadZone } from '@/components/organisms/PhotoUploadZone'
import { ProductNotesForm } from '@/components/organisms/ProductNotesForm'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params   // CRITICAL: Next.js 16 async params

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('*, photo_hashes(*)')
    .eq('id', id)
    .single()

  if (!product) notFound()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  return (
    <DetailTemplate
      breadcrumb={
        <Link href="/products" className="hover:text-foreground transition-colors">
          Products
        </Link>
      }
      title="Product"
    >
      <div className="space-y-6">
        {/* Photo row */}
        {product.photo_hashes.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto py-1">
            {product.photo_hashes.map((photo: { id: string; storage_path: string; alt_text: string }, i: number) => (
              <PhotoThumb
                key={photo.id}
                src={`${supabaseUrl}/storage/v1/object/public/product-photos/${photo.storage_path}`}
                alt={photo.alt_text || `Product photo ${i + 1}`}
                size="lg"
                className="shrink-0"
              />
            ))}
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground">No photos yet.</p>
        )}

        {/* Add photos */}
        <PhotoUploadZone productId={id} />

        {/* Notes */}
        <ProductNotesForm
          productId={id}
          initialNotes={product.notes ?? ''}
        />
      </div>
    </DetailTemplate>
  )
}
