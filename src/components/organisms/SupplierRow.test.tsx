import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock("@/components/organisms/SupplierSheet", () => ({
  SupplierSheet: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
}))

import { SupplierRow } from "./SupplierRow"
import type { Database } from "@/types/database"

type SupplierRowType = Database["public"]["Tables"]["suppliers"]["Row"]

const baseSupplier: SupplierRowType = {
  id: "s1",
  name: "Nike Supplier",
  is_flagged: false,
  yupoo_url: "https://supplier.yupoo.com",
  whatsapp_contact: "+5511999999999",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "user1",
  updated_at: "2026-01-01T00:00:00Z",
  trust_notes: null,
  red_flag_source: null,
  negotiation_opening_price: null,
  negotiation_final_price: null,
}

describe("SupplierRow", () => {
  it("renders supplier name", () => {
    render(<SupplierRow supplier={baseSupplier} activeInquiryCount={0} />)
    expect(screen.getByText("Nike Supplier")).toBeInTheDocument()
  })

  it("renders a BrandTagChip for each brand", () => {
    render(
      <SupplierRow
        supplier={{
          ...baseSupplier,
          supplier_brands: [
            { brand_id: "b1", brand: { name: "Nike" } },
            { brand_id: "b2", brand: { name: "Adidas" } },
          ],
        }}
        activeInquiryCount={0}
      />,
    )
    expect(screen.getByText("Nike")).toBeInTheDocument()
    expect(screen.getByText("Adidas")).toBeInTheDocument()
  })

  it("renders PriceRange when priceRange is provided", () => {
    render(
      <SupplierRow
        supplier={baseSupplier}
        priceRange={{ min: 45, max: 62 }}
        activeInquiryCount={0}
      />
    )
    // Formatted as BRL currency range
    const priceEl = screen.getByText(/45/)
    expect(priceEl).toBeInTheDocument()
  })

  it("does NOT render PriceRange when priceRange is not provided", () => {
    render(<SupplierRow supplier={baseSupplier} activeInquiryCount={0} />)
    // No currency symbol should appear for price
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
  })

  it("renders RedFlagIcon when is_flagged is true", () => {
    const flaggedSupplier = { ...baseSupplier, is_flagged: true }
    render(<SupplierRow supplier={flaggedSupplier} activeInquiryCount={0} />)
    expect(screen.getByLabelText("Flagged supplier")).toBeInTheDocument()
  })

  it("does NOT render RedFlagIcon when is_flagged is false", () => {
    render(<SupplierRow supplier={baseSupplier} activeInquiryCount={0} />)
    expect(screen.queryByLabelText("Flagged supplier")).not.toBeInTheDocument()
  })

  it("renders active inquiry count when count > 0", () => {
    render(<SupplierRow supplier={baseSupplier} activeInquiryCount={3} />)
    expect(screen.getByText("3 Active Threads")).toBeInTheDocument()
  })

  it("does NOT render active count label when count is 0", () => {
    render(<SupplierRow supplier={baseSupplier} activeInquiryCount={0} />)
    expect(screen.queryByText(/active/)).not.toBeInTheDocument()
  })
})
