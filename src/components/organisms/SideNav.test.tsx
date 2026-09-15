import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import SideNav from "./SideNav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

const mockUsePathname = vi.mocked(usePathname);

function renderSideNav(props?: { collapsed?: boolean }) {
  return render(
    <TooltipProvider>
      <SideNav {...props} />
    </TooltipProvider>
  );
}

describe("SideNav", () => {
  describe("active state", () => {
    it("marks Workspace active for /workspace", () => {
      mockUsePathname.mockReturnValue("/workspace");
      renderSideNav();

      const workspaceLink = screen.getByRole("link", { name: /workspace/i });
      expect(workspaceLink).toHaveClass("text-foreground");
    });

    it("marks Workspace active for secondary register routes", () => {
      mockUsePathname.mockReturnValue("/suppliers");
      renderSideNav();

      const workspaceLink = screen.getByRole("link", { name: /workspace/i });
      expect(workspaceLink).toHaveClass("text-foreground");
    });

    it("marks Settings active on /settings", () => {
      mockUsePathname.mockReturnValue("/settings");
      renderSideNav();

      const settingsLink = screen.getByRole("link", { name: /settings/i });
      expect(settingsLink).toHaveClass("text-foreground");
    });

    it("marks Review active without also marking Workspace active", () => {
      mockUsePathname.mockReturnValue("/workspace/review");
      renderSideNav();

      const reviewLink = screen.getByRole("link", { name: /review/i });
      const workspaceLink = screen.getByRole("link", { name: /workspace/i });

      expect(reviewLink).toHaveClass("text-foreground");
      expect(workspaceLink).toHaveClass("text-muted-foreground");
    });

    it("inactive item keeps muted foreground styling", () => {
      mockUsePathname.mockReturnValue("/workspace");
      renderSideNav();

      const settingsLink = screen.getByRole("link", { name: /settings/i });
      expect(settingsLink).toHaveClass("text-muted-foreground");
    });
  });

  describe("collapsed mode (icon-only)", () => {
    it("links in collapsed mode contain no visible span text", () => {
      mockUsePathname.mockReturnValue("/workspace");
      const { container } = renderSideNav({ collapsed: true });

      const nav = container.querySelector("nav");
      expect(nav).toBeTruthy();
      const anchors = nav!.querySelectorAll("a");
      anchors.forEach((anchor) => {
        expect(anchor.textContent?.trim()).toBe("");
      });
    });

    it("collapsed mode renders 3 navigation links (via anchors)", () => {
      mockUsePathname.mockReturnValue("/workspace");
      const { container } = renderSideNav({ collapsed: true });

      const nav = container.querySelector("nav");
      const anchors = nav!.querySelectorAll("a");
      expect(anchors).toHaveLength(3);
    });

    it("collapsed: workspace remains active in /products route", () => {
      mockUsePathname.mockReturnValue("/products");
      const { container } = renderSideNav({ collapsed: true });

      const nav = container.querySelector("nav");
      const activeAnchor = nav!.querySelector('a[href="/workspace"]');
      expect(activeAnchor).toHaveClass("text-foreground");
    });
  });

  describe("expanded mode", () => {
    it("renders label span text inside each link when not collapsed", () => {
      mockUsePathname.mockReturnValue("/workspace");
      renderSideNav({ collapsed: false });

      const workspaceLink = screen.getByRole("link", { name: /workspace/i });
      expect(within(workspaceLink).getByText("Workspace")).toBeInTheDocument();
    });

    it("renders workspace, review, and settings links", () => {
      mockUsePathname.mockReturnValue("/settings");
      renderSideNav();

      expect(screen.getByRole("link", { name: /workspace/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /review/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    });
  });
});
