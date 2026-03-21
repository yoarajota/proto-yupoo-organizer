import { describe, it, expect, vi, beforeEach } from "vitest"

// Chainable builder factory — returns self for every method except terminal ones
function makeBuilder(terminalValue: unknown) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  const chainMethods = ["select", "eq", "insert", "update", "upsert", "delete"]
  chainMethods.forEach((m) => {
    builder[m] = () => builder
  })
  builder.single = () => Promise.resolve(terminalValue)
  builder.maybeSingle = () => Promise.resolve(terminalValue)
  return builder
}

// Shared mocks
const mockGetUser = vi.fn()
const mockFromServer = vi.fn()
const mockFromAdmin = vi.fn()
const mockInviteUserByEmail = vi.fn()
const mockAdminSignOut = vi.fn()
const mockAdminListUsers = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFromServer,
  }),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: mockFromAdmin,
    auth: {
      admin: {
        inviteUserByEmail: mockInviteUserByEmail,
        signOut: mockAdminSignOut,
        listUsers: mockAdminListUsers,
      },
    },
  }),
}))

const { ensureProfile, inviteUser, deactivateUser } = await import("./users")

describe("ensureProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns { data: null, error: null } when no user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await ensureProfile()

    expect(result).toEqual({ data: null, error: null })
  })

  it("returns existing profile without inserting when profile already exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } })
    // First from call: select existing profile (maybeSingle returns data)
    mockFromServer.mockReturnValueOnce(makeBuilder({ data: { id: "user1", role: "admin" }, error: null }))

    const result = await ensureProfile()

    expect(result).toEqual({ data: { id: "user1", role: "admin" }, error: null })
    expect(mockFromAdmin).not.toHaveBeenCalled()
  })

  it("creates admin profile when no profiles exist (first user)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } })

    // First from call: maybeSingle → no existing profile
    const noProfile = makeBuilder({ data: null, error: null })
    // Second from call: count → 0
    const countBuilder: Record<string, (...args: unknown[]) => unknown> = {
      select: () => Promise.resolve({ count: 0, error: null }),
    }
    mockFromServer
      .mockReturnValueOnce(noProfile)
      .mockReturnValueOnce(countBuilder)

    // Admin client insert → returns new profile
    mockFromAdmin.mockReturnValueOnce(makeBuilder({ data: { id: "user1", role: "admin", is_active: true }, error: null }))

    const result = await ensureProfile()

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ role: "admin" })
  })
})

describe("inviteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns error for invalid email input", async () => {
    const result = await inviteUser({ email: "not-an-email" })

    expect(result).toEqual({ data: null, error: { message: "Invalid email." } })
  })

  it("returns error when caller is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await inviteUser({ email: "new@example.com" })

    expect(result).toEqual({ data: null, error: { message: "Unauthorized" } })
  })

  it("returns error when caller is not an admin (non-admin cannot invite)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user2" } } })
    // Profile select returns member role
    mockFromServer.mockReturnValueOnce(makeBuilder({ data: { role: "member" }, error: null }))

    const result = await inviteUser({ email: "new@example.com" })

    expect(result).toEqual({ data: null, error: { message: "Only admins can invite users." } })
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })
})

describe("deactivateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns error when trying to deactivate own account", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin1" } } })

    const result = await deactivateUser("admin1")

    expect(result).toEqual({ data: null, error: { message: "Cannot deactivate yourself." } })
  })

  it("returns error when caller is not an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user2" } } })
    mockFromServer.mockReturnValueOnce(makeBuilder({ data: { role: "member" }, error: null }))

    const result = await deactivateUser("user3")

    expect(result).toEqual({ data: null, error: { message: "Only admins can deactivate users." } })
  })

  it("returns error when caller is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await deactivateUser("user1")

    expect(result).toEqual({ data: null, error: { message: "Unauthorized" } })
  })
})
