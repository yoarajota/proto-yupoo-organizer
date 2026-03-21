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
    it("active item has border-primary class for /active-inquiries", () => {
      mockUsePathname.mockReturnValue("/active-inquiries");
      renderSideNav();

      const activeLink = screen.getByRole("link", { name: /inquiries/i });
      expect(activeLink).toHaveClass("border-primary");
    });

    it("active item has font-semibold and border-primary for /suppliers", () => {
      mockUsePathname.mockReturnValue("/suppliers");
      renderSideNav();

      const activeLink = screen.getByRole("link", { name: /suppliers/i });
      expect(activeLink).toHaveClass("font-semibold");
      expect(activeLink).toHaveClass("border-primary");
    });

    it("inactive items do NOT have border-primary class", () => {
      mockUsePathname.mockReturnValue("/active-inquiries");
      renderSideNav();

      const suppliersLink = screen.getByRole("link", { name: /suppliers/i });
      const productsLink = screen.getByRole("link", { name: /products/i });
      const sourcesLink = screen.getByRole("link", { name: /sources/i });

      expect(suppliersLink).not.toHaveClass("border-primary");
      expect(productsLink).not.toHaveClass("border-primary");
      expect(sourcesLink).not.toHaveClass("border-primary");
    });

    it("inactive items have muted-foreground text", () => {
      mockUsePathname.mockReturnValue("/active-inquiries");
      renderSideNav();

      const suppliersLink = screen.getByRole("link", { name: /suppliers/i });
      expect(suppliersLink).toHaveClass("text-muted-foreground");
    });
  });

  describe("collapsed mode (icon-only)", () => {
    it("links in collapsed mode contain no visible span text", () => {
      mockUsePathname.mockReturnValue("/active-inquiries");
      const { container } = renderSideNav({ collapsed: true });

      const nav = container.querySelector("nav");
      expect(nav).toBeTruthy();
      // All anchor links inside nav should have no span children
      const anchors = nav!.querySelectorAll("a");
      anchors.forEach((anchor) => {
        expect(anchor.querySelector("span")).toBeNull();
      });
    });

    it("collapsed mode renders 4 navigation links (via anchors)", () => {
      mockUsePathname.mockReturnValue("/active-inquiries");
      const { container } = renderSideNav({ collapsed: true });

      const nav = container.querySelector("nav");
      const anchors = nav!.querySelectorAll("a");
      expect(anchors).toHaveLength(4);
    });

    it("collapsed: active link still has border-primary", () => {
      mockUsePathname.mockReturnValue("/products");
      const { container } = renderSideNav({ collapsed: true });

      const nav = container.querySelector("nav");
      const activeAnchor = nav!.querySelector('a[href="/products"]');
      expect(activeAnchor).toHaveClass("border-primary");
    });
  });

  describe("expanded mode", () => {
    it("renders label span text inside each link when not collapsed", () => {
      mockUsePathname.mockReturnValue("/active-inquiries");
      renderSideNav({ collapsed: false });

      const inquiriesLink = screen.getByRole("link", { name: /inquiries/i });
      expect(within(inquiriesLink).getByText("Inquiries")).toBeInTheDocument();
    });

    it("renders all 4 nav links", () => {
      mockUsePathname.mockReturnValue("/suppliers");
      renderSideNav();

      expect(screen.getByRole("link", { name: /inquiries/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /suppliers/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /products/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /sources/i })).toBeInTheDocument();
    });
  });
});
