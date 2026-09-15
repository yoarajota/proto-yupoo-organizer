"use client"

import { useState, useTransition } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SupplierSchema, type SupplierFormValues } from "@/lib/schemas/supplier"
import { createSupplier, updateSupplier } from "@/actions/suppliers"
import { CatalogCheckboxGroup } from "@/components/molecules/CatalogCheckboxGroup"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import type { CatalogOption } from "@/lib/catalog"
import type { SupplierBrandLink, SupplierProductTypeLink } from "@/lib/supplier-catalog"
import type { Database } from "@/types/database"

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"]
type SupplierWithCatalogLinks = SupplierRow & {
  supplier_brands?: SupplierBrandLink[]
  supplier_product_types?: SupplierProductTypeLink[]
}

interface SupplierSheetProps {
  supplier?: SupplierWithCatalogLinks
  trigger: React.ReactNode
  brands?: CatalogOption[]
  productTypes?: CatalogOption[]
}

export function SupplierSheet({
  supplier,
  trigger,
  brands = [],
  productTypes = [],
}: SupplierSheetProps) {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(SupplierSchema),
    mode: "onBlur",
    defaultValues: supplier
      ? {
          name: supplier.name,
          yupoo_url: supplier.yupoo_url,
          whatsapp_contact: supplier.whatsapp_contact,
          brand_ids: supplier.supplier_brands?.map((item) => item.brand_id) ?? [],
          product_type_ids:
            supplier.supplier_product_types?.map((item) => item.product_type_id) ?? [],
          trust_notes: supplier.trust_notes ?? undefined,
          is_flagged: supplier.is_flagged,
          red_flag_source: supplier.red_flag_source ?? undefined,
          negotiation_opening_price: supplier.negotiation_opening_price ?? undefined,
          negotiation_final_price: supplier.negotiation_final_price ?? undefined,
        }
      : {
          brand_ids: [],
          product_type_ids: [],
          is_flagged: false,
        },
  })

  function onSubmit(values: SupplierFormValues) {
    setFormError(null)
    startTransition(async () => {
      const result = supplier
        ? await updateSupplier(supplier.id, values)
        : await createSupplier(values)

      if (result.error) {
        setFormError(result.error.message)
        return
      }
      reset()
      setOpen(false)
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger as React.ReactElement} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{supplier ? "Edit Supplier" : "Add Supplier"}</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 p-6 flex-1 overflow-y-auto"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-label-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              {...register("name")}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring aria-invalid:border-destructive"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-label-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="yupoo_url" className="text-label-sm font-medium">
              Yupoo URL <span className="text-destructive">*</span>
            </label>
            <input
              id="yupoo_url"
              {...register("yupoo_url")}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring aria-invalid:border-destructive"
              aria-invalid={!!errors.yupoo_url}
            />
            {errors.yupoo_url && (
              <p className="text-label-xs text-destructive">{errors.yupoo_url.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="whatsapp_contact" className="text-label-sm font-medium">
              WhatsApp <span className="text-destructive">*</span>
            </label>
            <input
              id="whatsapp_contact"
              {...register("whatsapp_contact")}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring aria-invalid:border-destructive"
              aria-invalid={!!errors.whatsapp_contact}
            />
            {errors.whatsapp_contact && (
              <p className="text-label-xs text-destructive">{errors.whatsapp_contact.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Controller
              name="brand_ids"
              control={control}
              render={({ field }) => (
                <CatalogCheckboxGroup
                  label="Brands"
                  options={brands}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  emptyMessage="Register brands in Settings before linking them."
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Controller
              name="product_type_ids"
              control={control}
              render={({ field }) => (
                <CatalogCheckboxGroup
                  label="Product Types"
                  options={productTypes}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  emptyMessage="Register product types in Settings before linking them."
                />
              )}
            />
          </div>

          {formError && (
            <p className="text-label-xs text-destructive">{formError}</p>
          )}
        </form>

        <SheetFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
          >
            {isPending ? "Saving…" : supplier ? "Save Changes" : "Add Supplier"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
