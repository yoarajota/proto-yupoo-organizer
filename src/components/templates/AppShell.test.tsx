import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./AppShell";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/workspace"),
}));

function renderAppShell(children: React.ReactNode = <div>Test content</div>) {
  return render(
    <TooltipProvider>
      <AppShell topBar={<div>Yupoo Organizer</div>}>{children}</AppShell>
    </TooltipProvider>
  );
}

describe("AppShell", () => {
  it("renders children", () => {
    renderAppShell(<div>Test content</div>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders TopBar with app name", () => {
    renderAppShell();
    expect(screen.getByText("Yupoo Organizer")).toBeInTheDocument();
  });

  it("renders main navigation (SideNav)", () => {
    renderAppShell();
    const navElements = screen.getAllByRole("navigation", { name: /main navigation/i });
    expect(navElements.length).toBeGreaterThan(0);
  });

  it("renders bottom tab bar for mobile", () => {
    renderAppShell();
    expect(screen.getByRole("navigation", { name: /bottom navigation/i })).toBeInTheDocument();
  });
});
