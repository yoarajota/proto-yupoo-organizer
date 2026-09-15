import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

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

import { SupplierDirectory, type SupplierWithStats } from "./SupplierDirectory"

const makeSupplier = (overrides: Partial<SupplierWithStats> & { id: string; name: string }): SupplierWithStats => ({
  id: overrides.id,
  name: overrides.name,
  supplier_brands: overrides.supplier_brands ?? [],
  is_flagged: overrides.is_flagged ?? false,
  yupoo_url: "https://supplier.yupoo.com",
  whatsapp_contact: "+5511999999999",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "user1",
  updated_at: "2026-01-01T00:00:00Z",
  trust_notes: null,
  red_flag_source: null,
  negotiation_opening_price: null,
  negotiation_final_price: null,
  priceRange: overrides.priceRange,
  activeInquiryCount: overrides.activeInquiryCount ?? 0,
})

const suppliers: SupplierWithStats[] = [
  makeSupplier({
    id: "s1",
    name: "Nike Store",
    supplier_brands: [
      { brand_id: "b1", brand: { name: "Nike" } },
      { brand_id: "b2", brand: { name: "Jordan" } },
    ],
  }),
  makeSupplier({
    id: "s2",
    name: "Adidas Hub",
    supplier_brands: [{ brand_id: "b3", brand: { name: "Adidas" } }],
  }),
  makeSupplier({
    id: "s3",
    name: "Multi Brand",
    supplier_brands: [
      { brand_id: "b1", brand: { name: "Nike" } },
      { brand_id: "b3", brand: { name: "Adidas" } },
    ],
  }),
]

const allBrands = ["Adidas", "Jordan", "Nike"]

describe("SupplierDirectory", () => {
  it("renders all suppliers initially", () => {
    render(<SupplierDirectory suppliers={suppliers} allBrands={allBrands} />)
    expect(screen.getByText("Nike Store")).toBeInTheDocument()
    expect(screen.getByText("Adidas Hub")).toBeInTheDocument()
    expect(screen.getByText("Multi Brand")).toBeInTheDocument()
  })

  it("filters by name when typing in search", () => {
    render(<SupplierDirectory suppliers={suppliers} allBrands={allBrands} />)
    const input = screen.getByPlaceholderText("Search suppliers…")
    fireEvent.change(input, { target: { value: "Nike" } })
    expect(screen.getByText("Nike Store")).toBeInTheDocument()
    expect(screen.queryByText("Adidas Hub")).not.toBeInTheDocument()
    expect(screen.queryByText("Multi Brand")).not.toBeInTheDocument()
  })

  it("filters by brand chip click", () => {
    render(<SupplierDirectory suppliers={suppliers} allBrands={allBrands} />)
    const adidasChip = screen.getAllByText("Adidas")[0]
    fireEvent.click(adidasChip)
    expect(screen.queryByText("Nike Store")).not.toBeInTheDocument()
    expect(screen.getByText("Adidas Hub")).toBeInTheDocument()
    expect(screen.getByText("Multi Brand")).toBeInTheDocument()
  })

  it("clears brand filter when clicking active chip again", () => {
    render(<SupplierDirectory suppliers={suppliers} allBrands={allBrands} />)
    const adidasChip = screen.getAllByText("Adidas")[0]
    fireEvent.click(adidasChip)
    expect(screen.queryByText("Nike Store")).not.toBeInTheDocument()
    // Click again to deselect
    fireEvent.click(adidasChip)
    expect(screen.getByText("Nike Store")).toBeInTheDocument()
    expect(screen.getByText("Adidas Hub")).toBeInTheDocument()
  })

  it("shows empty state when no suppliers", () => {
    render(<SupplierDirectory suppliers={[]} allBrands={[]} addSupplierTrigger={<button>Add Supplier</button>} />)
    expect(screen.getByText("Add your first supplier to get started")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Supplier" })).toBeInTheDocument()
  })

  it("shows no-results state when filter produces nothing", () => {
    render(<SupplierDirectory suppliers={suppliers} allBrands={allBrands} />)
    const input = screen.getByPlaceholderText("Search suppliers…")
    fireEvent.change(input, { target: { value: "zzz-no-match" } })
    expect(screen.getByText(/no results for/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument()
  })

  it("Clear filters link resets both search and brand filters", () => {
    render(<SupplierDirectory suppliers={suppliers} allBrands={allBrands} />)
    const input = screen.getByPlaceholderText("Search suppliers…")
    fireEvent.change(input, { target: { value: "zzz-no-match" } })
    expect(screen.getByText(/no results/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }))
    expect(screen.getByText("Nike Store")).toBeInTheDocument()
    expect(screen.getByText("Adidas Hub")).toBeInTheDocument()
    expect(screen.getByText("Multi Brand")).toBeInTheDocument()
  })
})
