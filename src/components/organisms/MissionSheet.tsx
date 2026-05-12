"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateSourcingMissionSchema, type CreateSourcingMissionValues } from "@/lib/schemas/sourcing-mission";
import { createSourcingMission } from "@/actions/sourcing-missions";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface MissionSheetProps {
  trigger: React.ReactNode;
}

export function MissionSheet({ trigger }: MissionSheetProps) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSourcingMissionValues>({
    resolver: zodResolver(CreateSourcingMissionSchema),
    mode: "onBlur",
    defaultValues: {
      seed_url: "",
    },
  });

  function onSubmit(values: CreateSourcingMissionValues) {
    setFormError(null);
    startTransition(async () => {
      const result = await createSourcingMission(values);

      if (result.error) {
        setFormError(result.error.message);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen && isPending) return; // Prevent closing while submitting
      setOpen(isOpen);
    }}>
      <SheetTrigger render={trigger as React.ReactElement} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New Sourcing Mission</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 p-6 flex-1 overflow-y-auto"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="seed_url" className="text-label-sm font-medium">
              Shop URL <span className="text-destructive">*</span>
            </label>
            <input
              id="seed_url"
              {...register("seed_url")}
              placeholder="https://west42.x.yupoo.com/"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring aria-invalid:border-destructive"
              aria-invalid={!!errors.seed_url}
            />
            {errors.seed_url && (
              <p className="text-label-xs text-destructive">{errors.seed_url.message as React.ReactNode}</p>
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
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
            className="flex-1"
          >
            {isPending ? "Creating..." : "Create Scrape"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
