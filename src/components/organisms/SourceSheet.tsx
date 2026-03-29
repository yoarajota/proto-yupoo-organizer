"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SourceCreateSchema, type SourceCreateValues } from "@/lib/schemas/source";
import { createSource } from "@/actions/sources";
import { BrandTagInput } from "@/components/molecules/BrandTagInput";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface SourceSheetProps {
  trigger: React.ReactNode;
}

export function SourceSheet({ trigger }: SourceSheetProps) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SourceCreateValues>({
    resolver: zodResolver(SourceCreateSchema),
    mode: "onBlur",
    defaultValues: {
      brands: [],
      url: "",
      platform: "reddit",
      notes: "",
    },
  });

  function onSubmit(values: SourceCreateValues) {
    setFormError(null);
    startTransition(async () => {
      const result = await createSource(values);

      if (result.error) {
        setFormError(result.error.message);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger as React.ReactElement} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Source</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 p-6 flex-1 overflow-y-auto"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="url" className="text-label-sm font-medium">
              URL <span className="text-destructive">*</span>
            </label>
            <input
              id="url"
              {...register("url")}
              placeholder="https://..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring aria-invalid:border-destructive"
              aria-invalid={!!errors.url}
            />
            {errors.url && (
              <p className="text-label-xs text-destructive">{errors.url.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="platform" className="text-label-sm font-medium">
              Platform <span className="text-destructive">*</span>
            </label>
            <select
              id="platform"
              {...register("platform")}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring"
            >
              <option value="reddit">Reddit</option>
              <option value="discord">Discord</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="other">Other</option>
            </select>
            {errors.platform && (
              <p className="text-label-xs text-destructive">{errors.platform.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-medium">Brand Tags</label>
            <Controller
              name="brands"
              control={control}
              render={({ field }) => (
                <BrandTagInput value={field.value ?? []} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="notes" className="text-label-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              {...register("notes")}
              rows={3}
              placeholder="Add research notes..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
            />
            {errors.notes && (
              <p className="text-label-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>

          {formError && (
            <p className="text-label-xs text-destructive mt-2">{formError}</p>
          )}
        </form>

        <SheetFooter className="p-6 pt-2 border-t border-border mt-auto">
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
            className="flex-1"
          >
            {isPending ? "Adding…" : "Add Source"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
