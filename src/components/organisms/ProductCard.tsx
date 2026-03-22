import Link from 'next/link'
import { Camera } from 'lucide-react'
import { PhotoThumb } from '@/components/atoms/PhotoThumb'
import type { Database } from '@/types/database'

type ProductRow = Database['public']['Tables']['products']['Row']
type PhotoHashRow = Database['public']['Tables']['photo_hashes']['Row']

interface ProductCardProps {
  product: ProductRow & { photo_hashes: PhotoHashRow[] }
}

export function ProductCard({ product }: ProductCardProps) {
  const firstPhoto = product.photo_hashes[0]
  const publicUrl = firstPhoto
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/${firstPhoto.storage_path}`
    : null

  const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
    new Date(product.created_at)
  )

  return (
    <Link href={`/products/${product.id}`}>
      <div className="rounded-lg border border-border bg-surface-container-lowest overflow-hidden hover:border-primary transition-colors">
        <div className="aspect-square">
          {publicUrl ? (
            <PhotoThumb
              src={publicUrl}
              alt={firstPhoto?.alt_text || 'Product photo'}
              size="lg"
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full bg-surface-container-low flex items-center justify-center">
              <Camera className="text-muted-foreground" size={24} />
            </div>
          )}
        </div>
        <div className="p-2">
          {product.notes && (
            <p className="line-clamp-2 text-label-sm text-muted-foreground">{product.notes}</p>
          )}
          <p className="text-label-xs text-muted-foreground mt-1">{formattedDate}</p>
        </div>
      </div>
    </Link>
  )
}
