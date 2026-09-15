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
import { isUiPreviewMode } from '@/lib/preview'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params // CRITICAL: Next.js 16 async params

  if (isUiPreviewMode()) {
    return (
      <DetailTemplate
        breadcrumb={
          <Link href="/workspace/products" className="hover:text-foreground transition-colors">
            Products
          </Link>
        }
        title="City tote reference"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="space-y-5">
            <div className="grid aspect-[16/10] place-items-center border border-border/70 bg-[linear-gradient(135deg,var(--surface-container-high),var(--surface-container-low),var(--background))]">
              <div className="grid h-28 w-28 place-items-center border border-foreground/20 bg-background/70 font-heading text-3xl">
                PR
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="border border-border/70 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand</p>
                <p className="mt-2 font-semibold">Prada</p>
              </div>
              <div className="border border-border/70 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Type</p>
                <p className="mt-2 font-semibold">Bags</p>
              </div>
              <div className="border border-border/70 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Inquiries</p>
                <p className="mt-2 font-semibold">2 active</p>
              </div>
            </div>
            <section className="border border-border/70 bg-background p-5">
              <h2 className="text-xl font-heading">Market notes</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                City tote reference with contrast stitching. Prioritize suppliers with batch photos, interior stamp evidence, and stable leather grain.
              </p>
            </section>
          </section>
          <aside className="space-y-4">
            <div className="border border-border/70 bg-surface-container-low p-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Best offer</p>
              <p className="mt-3 text-3xl font-heading">R$ 142</p>
              <p className="mt-2 text-sm text-muted-foreground">West42 Atelier, negotiating</p>
            </div>
            <div className="border border-border/70 bg-background p-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Reference ID</p>
              <p className="mt-3 text-sm text-muted-foreground">{id}</p>
            </div>
          </aside>
        </div>
      </DetailTemplate>
    )
  }

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

  const [{ data: suppliers }, { data: brands }, { data: productTypes }] =
    await Promise.all([
      supabase.from('suppliers').select('id, name').order('name'),
      supabase.from('brands').select('id, name').order('name'),
      supabase.from('product_types').select('id, name').order('name'),
    ])

  return (
    <DetailTemplate
      breadcrumb={
        <Link href="/workspace" className="hover:text-foreground transition-colors">
          Workspace
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
                initialBrandId={product.brand_id}
                initialProductTypeId={product.product_type_id}
                brands={brands ?? []}
                productTypes={productTypes ?? []}
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
