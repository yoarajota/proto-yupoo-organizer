import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { MarketOverviewCallout } from "./MarketOverviewCallout"
import { InquiryWithSupplier } from "../organisms/InquiryRow"

const mockInquiries: InquiryWithSupplier[] = [
  {
    id: "1",
    product_id: "p1",
    supplier_id: "s1",
    status: "negotiating",
    price: 100,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "user1",
    suppliers: { name: "Supplier A" }
  },
  {
    id: "2",
    product_id: "p1",
    supplier_id: "s2",
    status: "decided",
    price: 80,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "user1",
    suppliers: { name: "Supplier B" }
  },
  {
    id: "3",
    product_id: "p1",
    supplier_id: "s3",
    status: "sent",
    price: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "user1",
    suppliers: { name: "Supplier C" }
  }
]

describe("MarketOverviewCallout", () => {
  it("renders null when no inquiries have prices", () => {
    const noPrices = mockInquiries.filter(i => i.price === null)
    const { container } = render(<MarketOverviewCallout inquiries={noPrices} />)
    expect(container.firstChild).toBeNull()
  })

  it("calculates price range correctly", () => {
    render(<MarketOverviewCallout inquiries={mockInquiries} />)
    // 2 quotes because only 2 have prices
    expect(screen.getByText(/2 quotes/)).toBeInTheDocument()
    // Range R$ 80 - R$ 100
    expect(screen.getByText(/R\$\s*80–R\$\s*100/)).toBeInTheDocument()
  })

  it("shows single price when min equals max", () => {
    const samePrice = [mockInquiries[0], { ...mockInquiries[1], price: 100 }] as InquiryWithSupplier[]
    render(<MarketOverviewCallout inquiries={samePrice} />)
    expect(screen.getByText(/2 quotes: R\$\s*100/)).toBeInTheDocument()
  })

  it("counts decided and negotiating inquiries correctly", () => {
    render(<MarketOverviewCallout inquiries={mockInquiries} />)
    expect(screen.getByText(/1 decided/)).toBeInTheDocument()
    expect(screen.getByText(/1 negotiating/)).toBeInTheDocument()
  })

  it("has the correct ARIA role", () => {
    render(<MarketOverviewCallout inquiries={mockInquiries} />)
    expect(screen.getByRole("region", { name: /Market Overview/i })).toBeInTheDocument()
  })
})
