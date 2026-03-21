import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the Supabase server client
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  }),
}))

// Import after mocking
const { signIn, signOut } = await import("./groups")

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns { data: session, error: null } on successful sign-in", async () => {
    const mockSession = { access_token: "token123", user: { id: "user1" } }
    mockSignInWithPassword.mockResolvedValue({
      data: { session: mockSession, user: { id: "user1" } },
      error: null,
    })

    const result = await signIn({ email: "test@example.com", password: "password123" })

    expect(result).toEqual({ data: mockSession, error: null })
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    })
  })

  it("returns { data: null, error: { message } } on auth error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    })

    const result = await signIn({ email: "bad@example.com", password: "wrongpass1" })

    expect(result).toEqual({
      data: null,
      error: { message: "Invalid login credentials" },
    })
  })

  it("rejects invalid input before calling Supabase", async () => {
    const result = await signIn({ email: "not-email", password: "short" })

    expect(result).toEqual({
      data: null,
      error: { message: "Invalid email or password format." },
    })
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it("returns error when session is null despite no auth error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: { id: "user1" } },
      error: null,
    })

    const result = await signIn({ email: "test@example.com", password: "password123" })

    expect(result).toEqual({
      data: null,
      error: { message: "Sign-in succeeded but no session was created." },
    })
  })

  it("never throws — always returns an object", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Some error" },
    })

    await expect(signIn({ email: "x@x.com", password: "12345678" })).resolves.toBeDefined()
  })
})

describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns { data: null, error: null } on success", async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const result = await signOut()

    expect(result).toEqual({ data: null, error: null })
  })

  it("returns { data: null, error: { message } } on signOut error", async () => {
    mockSignOut.mockResolvedValue({
      error: { message: "Sign out failed" },
    })

    const result = await signOut()

    expect(result).toEqual({ data: null, error: { message: "Sign out failed" } })
  })
})
