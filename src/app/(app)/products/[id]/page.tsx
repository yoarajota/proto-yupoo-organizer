import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DetailTemplate } from '@/components/templates/DetailTemplate'
import { ProductPhotoStrip } from '@/components/organisms/ProductPhotoStrip'
import { PhotoUploadZone } from '@/components/organisms/PhotoUploadZone'
import { ProductNotesForm } from '@/components/organisms/ProductNotesForm'
import { InquiryTable } from '@/components/organisms/InquiryTable'
import { InquirySheet } from '@/components/organisms/InquirySheet'
import { MarketOverviewCallout } from '@/components/molecules/MarketOverviewCallout'
import { Button } from '@/components/ui/button'
import { getSimilarityMatches } from '@/actions/products'
import { SimilarityAdvisoryBanner } from '@/components/molecules/SimilarityAdvisoryBanner'
import type { InquiryWithSupplier } from '@/components/organisms/InquiryRow'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params // CRITICAL: Next.js 16 async params

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('*, photo_hashes(*)')
    .eq('id', id)
    .single()

  if (!product) notFound()

  const { data: matches } = await getSimilarityMatches(id)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const { data: inquiries } = await supabase
    .from('inquiries')
    .select('*, suppliers(name)')
    .eq('product_id', id)
    .order('created_at', { ascending: false })

  const typedInquiries = inquiries || []

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name')

  return (
    <DetailTemplate
      breadcrumb={
        <Link href="/products" className="hover:text-foreground transition-colors">
          Products
        </Link>
      }
      title="Product"
    >
      <div className="space-y-8">
        {matches && matches.length > 0 && (
          <SimilarityAdvisoryBanner matches={matches} />
        )}

        {/* Photo row */}
        <ProductPhotoStrip
          photos={product.photo_hashes}
          supabaseUrl={supabaseUrl}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Inquiries Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Inquiries</h2>
                <InquirySheet 
                  productId={id} 
                  suppliers={suppliers || []} 
                  trigger={<Button variant="outline" size="sm">Add Inquiry</Button>}
                />
              </div>

              {typedInquiries.length > 0 && (
                <MarketOverviewCallout inquiries={typedInquiries as InquiryWithSupplier[]} />
              )}

              <InquiryTable inquiries={typedInquiries as InquiryWithSupplier[]} />
            </section>

            {/* Notes */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Notes</h2>
              <ProductNotesForm
                productId={id}
                initialNotes={product.notes ?? ''}
              />
            </section>
          </div>

          <div className="space-y-8">
            {/* Add photos */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Add Photos</h2>
              <PhotoUploadZone productId={id} />
            </section>
          </div>
        </div>
      </div>
    </DetailTemplate>
  )
}
