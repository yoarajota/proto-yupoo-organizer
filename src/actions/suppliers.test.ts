import { describe, it, expect, vi, beforeEach } from "vitest"

// Chainable builder factory
function makeBuilder(terminalValue: unknown) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  const chainMethods = ["select", "eq", "insert", "update", "upsert", "delete"]
  chainMethods.forEach((m) => {
    builder[m] = () => builder
  })
  builder.single = () => Promise.resolve(terminalValue)
  return builder
}

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

const { createSupplier, updateSupplier } = await import("./suppliers")

describe("createSupplier", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns error when required fields are missing", async () => {
    const result = await createSupplier({
      name: "",
      yupoo_url: "https://example.com",
      whatsapp_contact: "123",
      is_flagged: false,
    })

    expect(result).toEqual({ data: null, error: { message: "Invalid form data." } })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("returns error when yupoo_url is not a valid URL", async () => {
    const result = await createSupplier({
      name: "Supplier A",
      yupoo_url: "not-a-url",
      whatsapp_contact: "123",
      is_flagged: false,
    })

    expect(result).toEqual({ data: null, error: { message: "Invalid form data." } })
  })

  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await createSupplier({
      name: "Supplier A",
      yupoo_url: "https://example.yupoo.com",
      whatsapp_contact: "+5511999999",
      is_flagged: false,
    })

    expect(result).toEqual({ data: null, error: { message: "Unauthorized" } })
  })

  it("returns { data, error: null } on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } })
    const fakeSupplier = { id: "s1", name: "Supplier A" }
    mockFrom.mockReturnValueOnce(makeBuilder({ data: fakeSupplier, error: null }))

    const result = await createSupplier({
      name: "Supplier A",
      yupoo_url: "https://example.yupoo.com",
      whatsapp_contact: "+5511999999",
      is_flagged: false,
    })

    expect(result).toEqual({ data: fakeSupplier, error: null })
  })

  it("returns error when supabase insert fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } })
    mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: "DB error" } }))

    const result = await createSupplier({
      name: "Supplier A",
      yupoo_url: "https://example.yupoo.com",
      whatsapp_contact: "+5511999999",
      is_flagged: false,
    })

    expect(result).toEqual({ data: null, error: { message: "DB error" } })
  })

  it("never throws — always returns { data, error } shape", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } })
    mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: "Unexpected" } }))

    const result = await createSupplier({
      name: "Supplier B",
      yupoo_url: "https://supplier.yupoo.com",
      whatsapp_contact: "+5511888888",
      is_flagged: false,
    })

    expect(result).toHaveProperty("data")
    expect(result).toHaveProperty("error")
  })
})

describe("updateSupplier", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns error when validation fails", async () => {
    const result = await updateSupplier("s1", {
      name: "",
      yupoo_url: "https://example.yupoo.com",
      whatsapp_contact: "123",
      is_flagged: false,
    })

    expect(result).toEqual({ data: null, error: { message: "Invalid form data." } })
  })

  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await updateSupplier("s1", {
      name: "Supplier A",
      yupoo_url: "https://example.yupoo.com",
      whatsapp_contact: "+5511999999",
      is_flagged: false,
    })

    expect(result).toEqual({ data: null, error: { message: "Unauthorized" } })
  })

  it("returns { data, error: null } on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } })
    const updated = { id: "s1", name: "Updated" }
    mockFrom.mockReturnValueOnce(makeBuilder({ data: updated, error: null }))

    const result = await updateSupplier("s1", {
      name: "Updated",
      yupoo_url: "https://example.yupoo.com",
      whatsapp_contact: "+5511999999",
      is_flagged: false,
    })

    expect(result).toEqual({ data: updated, error: null })
  })
})
