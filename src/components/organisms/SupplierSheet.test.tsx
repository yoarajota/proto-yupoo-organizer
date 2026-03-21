import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// Mock server actions
vi.mock("@/actions/suppliers", () => ({
  createSupplier: vi.fn().mockResolvedValue({ data: { id: "s1" }, error: null }),
  updateSupplier: vi.fn().mockResolvedValue({ data: { id: "s1" }, error: null }),
}))

// Mock Sheet — always render all children to avoid portal/open-state issues in jsdom
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet">{children}</div>,
  SheetTrigger: ({ render: renderProp }: { render?: React.ReactElement }) => renderProp ?? null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetClose: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { SupplierSheet } from "./SupplierSheet"
import { createSupplier as mockCreateImport } from "@/actions/suppliers"
import { Button } from "@/components/ui/button"

const mockCreateSupplier = mockCreateImport as ReturnType<typeof vi.fn>

describe("SupplierSheet — create mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSupplier.mockResolvedValue({ data: { id: "s1" }, error: null })
  })

  it("renders the trigger button", () => {
    render(<SupplierSheet trigger={<Button>Add Supplier</Button>} />)
    // There are two "Add Supplier" buttons: the trigger and the submit button in the footer
    const buttons = screen.getAllByRole("button", { name: /add supplier/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it("shows inline validation error when name is blurred empty", async () => {
    render(<SupplierSheet trigger={<Button>Add Supplier</Button>} />)

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.focus(nameInput)
    fireEvent.blur(nameInput)

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })

  it("shows inline validation error when yupoo_url is invalid on blur", async () => {
    render(<SupplierSheet trigger={<Button>Add Supplier</Button>} />)

    const urlInput = screen.getByLabelText(/yupoo url/i)
    fireEvent.change(urlInput, { target: { value: "not-a-url" } })
    fireEvent.blur(urlInput)

    await waitFor(() => {
      expect(screen.getByText(/must be a valid url/i)).toBeInTheDocument()
    })
  })

  it("shows inline validation error when whatsapp is blurred empty", async () => {
    render(<SupplierSheet trigger={<Button>Add Supplier</Button>} />)

    const waInput = screen.getByLabelText(/whatsapp/i)
    fireEvent.focus(waInput)
    fireEvent.blur(waInput)

    await waitFor(() => {
      expect(screen.getByText(/whatsapp contact is required/i)).toBeInTheDocument()
    })
  })

  it("does not call createSupplier when required fields are empty", async () => {
    render(<SupplierSheet trigger={<Button>Add Supplier</Button>} />)

    // The footer has the submit button; use the last matching button
    const allButtons = screen.getAllByRole("button", { name: /add supplier/i })
    fireEvent.click(allButtons[allButtons.length - 1])

    await waitFor(() => {
      // name validation fires
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })

    expect(mockCreateSupplier).not.toHaveBeenCalled()
  })

  it("calls createSupplier with valid form data", async () => {
    render(<SupplierSheet trigger={<Button>Add Supplier</Button>} />)

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Supplier X" } })
    fireEvent.change(screen.getByLabelText(/yupoo url/i), { target: { value: "https://supplier.yupoo.com" } })
    fireEvent.change(screen.getByLabelText(/whatsapp/i), { target: { value: "+5511999999999" } })

    // Click the "Add Supplier" submit button (there are two: trigger + footer button)
    const allButtons = screen.getAllByRole("button", { name: /add supplier/i })
    // The last "Add Supplier" button is the submit one in the footer
    fireEvent.click(allButtons[allButtons.length - 1])

    await waitFor(() => {
      expect(mockCreateSupplier).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Supplier X",
          yupoo_url: "https://supplier.yupoo.com",
          whatsapp_contact: "+5511999999999",
        })
      )
    })
  })

  it("shows error message when createSupplier returns an error", async () => {
    mockCreateSupplier.mockResolvedValueOnce({ data: null, error: { message: "Server error" } })

    render(<SupplierSheet trigger={<Button>Add Supplier</Button>} />)

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Supplier X" } })
    fireEvent.change(screen.getByLabelText(/yupoo url/i), { target: { value: "https://supplier.yupoo.com" } })
    fireEvent.change(screen.getByLabelText(/whatsapp/i), { target: { value: "+5511999999999" } })

    const allButtons = screen.getAllByRole("button", { name: /add supplier/i })
    fireEvent.click(allButtons[allButtons.length - 1])

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })
})
