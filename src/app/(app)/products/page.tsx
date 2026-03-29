import { createClient } from '@/lib/supabase/server'
import { GalleryTemplate } from '@/components/templates/GalleryTemplate'
import { PhotoUploadZone } from '@/components/organisms/PhotoUploadZone'
import { ProductCard } from '@/components/organisms/ProductCard'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from("products")
    .select(
      "*, photo_hashes(*, similarity_matches!source_photo_hash_id(is_dismissed))",
    )
    .order("created_at", { ascending: false });

  return (
    <GalleryTemplate title="Products">
      <PhotoUploadZone />

      {!products || products.length === 0 ? (
        <p className="text-body-sm text-muted-foreground mt-6">
          Upload your first product photos to get started
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mt-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </GalleryTemplate>
  )
}
