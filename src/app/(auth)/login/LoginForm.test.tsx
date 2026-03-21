import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}))

vi.mock("@/actions/groups", () => ({
  signIn: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

// Import after mocking
import { LoginForm } from "./LoginForm"
import { signIn as mockSignInImport } from "@/actions/groups"

const mockSignIn = mockSignInImport as ReturnType<typeof vi.fn>

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default resolved value after each test
    mockSignIn.mockResolvedValue({ data: null, error: null })
  })

  it("renders email and password fields and submit button", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
  })

  it("shows email validation error on blur when email is invalid", async () => {
    render(<LoginForm />)

    const emailInput = screen.getByLabelText(/email/i)

    fireEvent.change(emailInput, { target: { value: "notanemail" } })
    fireEvent.blur(emailInput)

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
    })
  })

  it("shows password validation error on blur when password is too short", async () => {
    render(<LoginForm />)

    const passwordInput = screen.getByLabelText(/password/i)

    fireEvent.change(passwordInput, { target: { value: "short" } })
    fireEvent.blur(passwordInput)

    await waitFor(() => {
      // Zod v4 generates a message about string minimum length
      expect(
        screen.getByText(/too small|at least 8|minimum|characters/i)
      ).toBeInTheDocument()
    })
  })

  it("does not redirect when signIn returns an error", async () => {
    const { useRouter } = await import("next/navigation")
    const mockRouter = useRouter()

    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    })

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!)
    })

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    })

    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it("submit button is disabled while pending", async () => {
    mockSignIn.mockImplementation(
      () => new Promise(() => {}) // never resolves
    )

    render(<LoginForm />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole("button", { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: "test@example.com" } })
    fireEvent.change(passwordInput, { target: { value: "password123" } })

    await act(async () => {
      fireEvent.submit(submitButton.closest("form")!)
    })

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled()
    })
  })
})
