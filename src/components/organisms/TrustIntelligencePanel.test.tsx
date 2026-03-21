import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/actions/suppliers", () => ({
  updateSupplier: vi.fn().mockResolvedValue({ data: {}, error: null }),
}))

import { TrustIntelligencePanel } from "./TrustIntelligencePanel"
import { updateSupplier as mockUpdateImport } from "@/actions/suppliers"

const mockUpdateSupplier = mockUpdateImport as ReturnType<typeof vi.fn>

const baseSupplier = {
  id: "s1",
  name: "Nike Factory",
  yupoo_url: "https://nike.yupoo.com",
  whatsapp_contact: "+5511999999999",
  brands: ["Nike"],
  trust_notes: "Reliable",
  is_flagged: false,
  red_flag_source: null,
  negotiation_opening_price: 100,
  negotiation_final_price: 80,
  created_by: "user1",
  created_at: "2026-01-01",
  workspace_id: "ws1",
}

describe("TrustIntelligencePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateSupplier.mockResolvedValue({ data: {}, error: null })
  })

  it("renders trust notes textarea with supplier's existing notes", () => {
    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    const textarea = screen.getByPlaceholderText(/add notes about this supplier/i)
    expect(textarea).toBeInTheDocument()
    expect((textarea as HTMLTextAreaElement).value).toBe("Reliable")
  })

  it("renders red flag switch in unchecked state when is_flagged is false", () => {
    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    const switchEl = screen.getByRole("switch")
    expect(switchEl).toBeInTheDocument()
    expect(switchEl).toHaveAttribute("aria-checked", "false")
  })

  it("does not render source link field when is_flagged is false", () => {
    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    expect(screen.queryByPlaceholderText(/source link/i)).not.toBeInTheDocument()
  })

  it("shows source link input when flag is toggled on", async () => {
    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    const switchEl = screen.getByRole("switch")
    fireEvent.click(switchEl)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/source link/i)).toBeInTheDocument()
    })
  })

  it("renders NegotiationElasticity component with price data", () => {
    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    expect(screen.getByText(/R\$\s*100/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*80/)).toBeInTheDocument()
  })

  it("calls updateSupplier when Save button is clicked on trust notes", async () => {
    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    const saveButton = screen.getByRole("button", { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateSupplier).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ trust_notes: "Reliable" })
      )
    })
  })

  it("auto-saves when red flag switch is toggled", async () => {
    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    const switchEl = screen.getByRole("switch")
    fireEvent.click(switchEl)

    await waitFor(() => {
      expect(mockUpdateSupplier).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ is_flagged: true })
      )
    })
  })

  it("shows inline error on trust notes section when updateSupplier fails", async () => {
    mockUpdateSupplier.mockResolvedValueOnce({ data: null, error: { message: "Network error" } })

    render(<TrustIntelligencePanel supplier={baseSupplier as never} />)
    const saveButton = screen.getByRole("button", { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it("renders supplier with is_flagged=true and shows source link input initially", () => {
    const flaggedSupplier = { ...baseSupplier, is_flagged: true, red_flag_source: "https://scam.example.com" }
    render(<TrustIntelligencePanel supplier={flaggedSupplier as never} />)
    const sourceInput = screen.getByPlaceholderText(/source link/i)
    expect(sourceInput).toBeInTheDocument()
    expect((sourceInput as HTMLInputElement).value).toBe("https://scam.example.com")
  })
})
