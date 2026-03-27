"use client"

import { useState, useTransition } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { InquiryCreateSchema, type InquiryCreateValues, type InquiryStatus } from "@/lib/schemas/inquiry"
import { createInquiry } from "@/actions/inquiries"
import { StatusDropdown } from "@/components/molecules/StatusDropdown"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface InquirySheetProps {
  productId: string
  suppliers: { id: string; name: string }[]
  trigger?: React.ReactNode
}

export function InquirySheet({ productId, suppliers, trigger }: InquirySheetProps) {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InquiryCreateValues>({
    resolver: zodResolver(InquiryCreateSchema),
    defaultValues: {
      product_id: productId,
      supplier_id: "",
      status: "sent",
      price: null,
      notes: "",
    },
  })

  function onSubmit(values: InquiryCreateValues) {
    setFormError(null)
    startTransition(async () => {
      const result = await createInquiry(values)

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
      <SheetTrigger>
        {trigger || <Button variant="outline">Add Inquiry</Button>}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Inquiry</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-6 py-6"
        >
          <div className="space-y-2">
            <Label htmlFor="supplier_id">Supplier</Label>
            <Controller
              name="supplier_id"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger className={cn(!!errors.supplier_id && "border-destructive")}>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.supplier_id && (
              <p className="text-label-xs text-destructive">
                {errors.supplier_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Initial Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <StatusDropdown 
                  value={field.value as InquiryStatus} 
                  onValueChange={field.onChange}
                  className="w-full"
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price (Optional)</Label>
            <Input
              id="price"
              type="number"
              placeholder="e.g. 150"
              {...register("price", { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <textarea
              id="notes"
              {...register("notes")}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Ask about size XL availability..."
            />
          </div>

          {formError && (
            <p className="text-label-xs text-destructive bg-destructive/10 p-2 rounded">{formError}</p>
          )}
        </form>

        <SheetFooter>
          <Button
            variant="ghost"
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
            {isPending ? "Adding..." : "Create Inquiry"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
