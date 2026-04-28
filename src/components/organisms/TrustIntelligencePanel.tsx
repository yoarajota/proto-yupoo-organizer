"use client"

import { useState, useTransition } from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NegotiationElasticity } from "@/components/molecules/NegotiationElasticity"
import { updateSupplier } from "@/actions/suppliers"
import { cn } from "@/lib/utils"
import type { Database } from "@/types/database"

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"]

interface TrustIntelligencePanelProps {
  supplier: SupplierRow
}

export function TrustIntelligencePanel({ supplier }: TrustIntelligencePanelProps) {
  const [trustNotes, setTrustNotes] = useState(supplier.trust_notes ?? "")
  const [isFlagged, setIsFlagged] = useState(supplier.is_flagged)
  const [redFlagSource, setRedFlagSource] = useState(supplier.red_flag_source ?? "")
  const [notesError, setNotesError] = useState<string | null>(null)
  const [flagError, setFlagError] = useState<string | null>(null)
  const [isPendingNotes, startNotesTransition] = useTransition()
  const [isPendingFlag, startFlagTransition] = useTransition()

  function buildPayload(overrides: Partial<{ isFlagged: boolean; redFlagSource: string; trustNotes: string }>) {
    return {
      name: supplier.name,
      yupoo_url: supplier.yupoo_url,
      whatsapp_contact: supplier.whatsapp_contact,
      is_flagged: overrides.isFlagged ?? isFlagged,
      red_flag_source: (overrides.redFlagSource ?? redFlagSource) || undefined,
      trust_notes: (overrides.trustNotes ?? trustNotes) || undefined,
      negotiation_opening_price: supplier.negotiation_opening_price ?? undefined,
      negotiation_final_price: supplier.negotiation_final_price ?? undefined,
    }
  }

  function handleSaveNotes() {
    setNotesError(null)
    startNotesTransition(async () => {
      const result = await updateSupplier(supplier.id, buildPayload({}))
      if (result.error) setNotesError(result.error.message)
    })
  }

  function handleFlagChange(checked: boolean) {
    setIsFlagged(checked)
    setFlagError(null)
    startFlagTransition(async () => {
      const result = await updateSupplier(supplier.id, buildPayload({ isFlagged: checked }))
      if (result.error) setFlagError(result.error.message)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Trust Notes */}
      <div className="rounded-lg border border-border bg-surface-container-low p-4 flex flex-col gap-3">
        <p className="text-label-sm font-medium text-muted-foreground uppercase tracking-widest">
          Trust Notes
        </p>
        <textarea
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring resize-none min-h-24 placeholder:text-muted-foreground"
          value={trustNotes}
          onChange={(e) => setTrustNotes(e.target.value)}
          placeholder="Add notes about this supplier's reliability…"
          rows={4}
        />
        {notesError && <p className="text-label-xs text-error">{notesError}</p>}
        <Button
          size="sm"
          onClick={handleSaveNotes}
          disabled={isPendingNotes}
        >
          {isPendingNotes ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Red Flag */}
      <div className="rounded-lg border border-border bg-surface-container-low p-4 flex flex-col gap-3">
        <p className="text-label-sm font-medium text-muted-foreground uppercase tracking-widest">
          Red Flag
        </p>
        <div className="flex items-center gap-3">
          <SwitchPrimitive.Root
            checked={isFlagged}
            onCheckedChange={handleFlagChange}
            disabled={isPendingFlag}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isFlagged ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <SwitchPrimitive.Thumb
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                isFlagged ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </SwitchPrimitive.Root>
          <span className="text-body-sm text-foreground">
            {isFlagged ? "Flagged" : "Not flagged"}
          </span>
        </div>
        {isFlagged && (
          <Input
            value={redFlagSource}
            onChange={(e) => setRedFlagSource(e.target.value)}
            placeholder="Source link (e.g. scam report URL)"
            className="text-body-sm"
          />
        )}
        {flagError && <p className="text-label-xs text-error">{flagError}</p>}
      </div>

      {/* Negotiation Elasticity */}
      <div className="rounded-lg border border-border bg-surface-container-low p-4 flex flex-col gap-3">
        <p className="text-label-sm font-medium text-muted-foreground uppercase tracking-widest">
          Price Elasticity
        </p>
        <NegotiationElasticity
          openingPrice={supplier.negotiation_opening_price}
          finalPrice={supplier.negotiation_final_price}
        />
      </div>
    </div>
  )
}
