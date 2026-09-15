import { beforeEach, describe, expect, it, vi } from "vitest"

function makeBuilder(terminalValue: unknown) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  const chainMethods = ["select", "eq", "insert", "update", "upsert", "delete"]
  chainMethods.forEach((method) => {
    builder[method] = () => builder
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

const { createBrand, createProductType, createBrandAlias } = await import("./catalog")

describe("catalog actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns unauthorized when no user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(createBrand({ name: "Prada" })).resolves.toEqual({
      data: null,
      error: { message: "Unauthorized" },
    })
  })

  it("rejects non-admin catalog creation", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockFrom.mockReturnValueOnce(makeBuilder({ data: { role: "member" }, error: null }))

    await expect(createBrand({ name: "Prada" })).resolves.toEqual({
      data: null,
      error: { message: "Only admins can manage catalog entries." },
    })
  })

  it("rejects non-admin product type creation", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockFrom.mockReturnValueOnce(makeBuilder({ data: { role: "member" }, error: null }))

    await expect(createProductType({ name: "Bags" })).resolves.toEqual({
      data: null,
      error: { message: "Only admins can manage catalog entries." },
    })
  })

  it("rejects non-admin brand alias creation", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mockFrom.mockReturnValueOnce(makeBuilder({ data: { role: "member" }, error: null }))

    await expect(createBrandAlias({
      brand_id: "550e8400-e29b-41d4-a716-446655440000",
      alias: "PRA*DA*",
    })).resolves.toEqual({
      data: null,
      error: { message: "Only admins can manage catalog entries." },
    })
  })

  it("allows admins to create brands without created_by", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: { role: "admin" }, error: null }))
      .mockReturnValueOnce(makeBuilder({
        data: { id: "brand-1", name: "Prada", slug: "prada" },
        error: null,
      }))

    const result = await createBrand({ name: "Prada" })

    expect(result).toEqual({
      data: { id: "brand-1", name: "Prada", slug: "prada" },
      error: null,
    })
    expect(mockFrom).toHaveBeenNthCalledWith(2, "brands")
  })

  it("allows admins to create product types without created_by", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: { role: "admin" }, error: null }))
      .mockReturnValueOnce(makeBuilder({
        data: { id: "type-1", name: "Bags", slug: "bags" },
        error: null,
      }))

    const result = await createProductType({ name: "Bags" })

    expect(result).toEqual({
      data: { id: "type-1", name: "Bags", slug: "bags" },
      error: null,
    })
    expect(mockFrom).toHaveBeenNthCalledWith(2, "product_types")
  })

  it("allows admins to create brand aliases without created_by", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: { role: "admin" }, error: null }))
      .mockReturnValueOnce(makeBuilder({
        data: {
          id: "alias-1",
          brand_id: "550e8400-e29b-41d4-a716-446655440000",
          alias: "PRA*DA*",
        },
        error: null,
      }))

    const result = await createBrandAlias({
      brand_id: "550e8400-e29b-41d4-a716-446655440000",
      alias: "PRA*DA*",
    })

    expect(result).toEqual({
      data: {
        id: "alias-1",
        brand_id: "550e8400-e29b-41d4-a716-446655440000",
        alias: "PRA*DA*",
      },
      error: null,
    })
    expect(mockFrom).toHaveBeenNthCalledWith(2, "brand_aliases")
  })
})
