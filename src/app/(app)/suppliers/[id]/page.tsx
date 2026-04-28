import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DetailTemplate } from "@/components/templates/DetailTemplate"
import { TrustIntelligencePanel } from "@/components/organisms/TrustIntelligencePanel"
import { BrandTagGroup } from "@/components/molecules/BrandTagGroup"
import { SupplierSheet } from "@/components/organisms/SupplierSheet"
import { InquiryTable } from "@/components/organisms/InquiryTable"
import { getInquiriesBySupplier } from "@/actions/inquiries"
import { Button } from "@/components/ui/button"
import { getSupplierBrandNames, getSupplierProductTypeNames } from "@/lib/supplier-catalog"
import type { InquiryWithSupplier } from "@/components/organisms/InquiryRow"

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*, supplier_brands(brand_id, brand:brands(name)), supplier_product_types(product_type_id, product_type:product_types(name))")
    .eq("id", id)
    .single()

  if (!supplier) notFound()

  const [{ data: inquiries }, { data: brands }, { data: productTypes }] = await Promise.all([
    getInquiriesBySupplier(id),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("product_types").select("id, name").order("name"),
  ])
  const typedInquiries = (inquiries || []) as InquiryWithSupplier[]
  const linkedBrands = getSupplierBrandNames(supplier)
  const linkedProductTypes = getSupplierProductTypeNames(supplier)

  return (
    <DetailTemplate
      breadcrumb={
        <>
          <Link href="/workspace" className="text-muted-foreground hover:text-foreground">
            Workspace
          </Link>
          <span className="text-muted-foreground mx-1">›</span>
          <span>{supplier.name}</span>
        </>
      }
      title={supplier.name}
      sideContent={<TrustIntelligencePanel supplier={supplier} />}
    >
      <div className="space-y-8">
        <div className="rounded-lg border border-border bg-surface-container-low p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-label-sm font-medium text-muted-foreground uppercase tracking-widest">
              Yupoo
            </p>
            <a
              href={supplier.yupoo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-sm text-primary hover:underline break-all"
            >
              {supplier.yupoo_url}
            </a>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-label-sm font-medium text-muted-foreground uppercase tracking-widest">
              WhatsApp
            </p>
            <p className="text-body-sm">{supplier.whatsapp_contact}</p>
          </div>

          {linkedBrands.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-label-sm font-medium text-muted-foreground uppercase tracking-widest">
                Brands
              </p>
              <BrandTagGroup brands={linkedBrands} />
            </div>
          )}

          {linkedProductTypes.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-label-sm font-medium text-muted-foreground uppercase tracking-widest">
                Product Types
              </p>
              <BrandTagGroup brands={linkedProductTypes} />
            </div>
          )}

          <div>
            <SupplierSheet
              supplier={supplier}
              brands={brands ?? []}
              productTypes={productTypes ?? []}
              trigger={
                <Button variant="outline" size="sm">
                  Edit Supplier
                </Button>
              }
            />
          </div>
        </div>

        {/* Linked Inquiries Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Linked Inquiries</h2>
          <InquiryTable 
            inquiries={typedInquiries} 
            showProductName={true} 
            emptyMessage="No inquiries logged for this supplier yet."
          />
        </section>
      </div>
    </DetailTemplate>
  )
}
