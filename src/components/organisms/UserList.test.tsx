import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/actions/users", () => ({
  deactivateUser: vi.fn().mockResolvedValue({ data: { deactivatedUserId: "user2" }, error: null }),
  reactivateUser: vi.fn().mockResolvedValue({ data: { reactivatedUserId: "user2" }, error: null }),
  inviteUser: vi.fn().mockResolvedValue({ data: { email: "new@example.com" }, error: null }),
}))

import UserList from "./UserList"
import { inviteUser as mockInviteImport } from "@/actions/users"

const mockInviteUser = mockInviteImport as ReturnType<typeof vi.fn>

const baseUsers = [
  {
    id: "admin1",
    role: "admin" as const,
    is_active: true,
    email: "admin@example.com",
    invited_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "user2",
    role: "member" as const,
    is_active: true,
    email: "member@example.com",
    invited_by: "admin1",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
]

describe("UserList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInviteUser.mockResolvedValue({ data: { email: "new@example.com" }, error: null })
  })

  it("does not show Deactivate button on own row (admin viewing own entry)", () => {
    render(<UserList users={baseUsers} isAdmin={true} currentUserId="admin1" />)

    // admin row should not have a deactivate button
    const rows = screen.getAllByText(/deactivate/i)
    // Only user2 row should show deactivate button
    expect(rows).toHaveLength(1)

    // Confirm the button is for user2, not admin1
    // admin@example.com row should not have a deactivate button near it
    expect(screen.getByText("admin@example.com")).toBeInTheDocument()
  })

  it("shows Deactivate button only for other users, not for own row", () => {
    render(<UserList users={baseUsers} isAdmin={true} currentUserId="admin1" />)

    const deactivateButtons = screen.getAllByRole("button", { name: /deactivate/i })
    expect(deactivateButtons).toHaveLength(1)
  })

  it("shows no action buttons for non-admin users", () => {
    render(<UserList users={baseUsers} isAdmin={false} currentUserId="user2" />)

    expect(screen.queryByRole("button", { name: /deactivate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /invite/i })).not.toBeInTheDocument()
  })

  it("invite form shows inline error when submitted with empty email", async () => {
    render(<UserList users={baseUsers} isAdmin={true} currentUserId="admin1" />)

    const inviteButton = screen.getByRole("button", { name: /invite/i })
    fireEvent.click(inviteButton)

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })

    expect(mockInviteUser).not.toHaveBeenCalled()
  })

  it("clears invite input on successful invite", async () => {
    render(<UserList users={baseUsers} isAdmin={true} currentUserId="admin1" />)

    const emailInput = screen.getByPlaceholderText(/user@example.com/i)
    fireEvent.change(emailInput, { target: { value: "new@example.com" } })

    const inviteButton = screen.getByRole("button", { name: /invite/i })
    fireEvent.click(inviteButton)

    await waitFor(() => {
      expect(screen.getByText(/invitation sent/i)).toBeInTheDocument()
    })

    expect((emailInput as HTMLInputElement).value).toBe("")
  })

  it("shows inline error when invite action returns an error", async () => {
    mockInviteUser.mockResolvedValueOnce({
      data: null,
      error: { message: "User already exists." },
    })

    render(<UserList users={baseUsers} isAdmin={true} currentUserId="admin1" />)

    const emailInput = screen.getByPlaceholderText(/user@example.com/i)
    fireEvent.change(emailInput, { target: { value: "existing@example.com" } })

    fireEvent.click(screen.getByRole("button", { name: /invite/i }))

    await waitFor(() => {
      expect(screen.getByText(/user already exists/i)).toBeInTheDocument()
    })
  })
})
