import Link from 'next/link'
import { Camera, AlertCircle } from 'lucide-react'
import { PhotoThumb } from '@/components/atoms/PhotoThumb'
import type { Database } from '@/types/database'

type ProductRow = Database['public']['Tables']['products']['Row']
type PhotoHashRow = Database['public']['Tables']['photo_hashes']['Row']

interface ProductCardProps {
  product: ProductRow & { 
    photo_hashes: (PhotoHashRow & { 
      similarity_matches?: { is_dismissed: boolean }[] 
    })[] 
  }
}

export function ProductCard({ product }: ProductCardProps) {
  const firstPhoto = product.photo_hashes[0]
  const publicUrl = firstPhoto
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/${firstPhoto.storage_path}`
    : null

  const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
    new Date(product.created_at)
  )

  const hasMatches = product.photo_hashes.some(
    ph => ph.similarity_matches?.some(m => !m.is_dismissed)
  )

  return (
    <Link href={`/products/${product.id}`}>
      <div className="rounded-lg border border-border bg-surface-container-lowest overflow-hidden hover:border-primary transition-colors relative">
        {hasMatches && (
          <div className="absolute top-2 right-2 z-10 bg-yellow-500 text-white rounded-full p-1 shadow-sm">
            <AlertCircle size={16} />
          </div>
        )}
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
          <p className="text-label-xs text-muted-foreground mt-1">
            {product.photo_hashes.length} {product.photo_hashes.length === 1 ? 'photo' : 'photos'}
          </p>
        </div>
      </div>
    </Link>
  )
}
