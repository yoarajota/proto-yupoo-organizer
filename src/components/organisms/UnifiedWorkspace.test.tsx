import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { UnifiedWorkspace } from "./UnifiedWorkspace"

vi.mock("./InquiryTable", () => ({
  InquiryTable: () => <div>Inquiry table</div>,
}))

vi.mock("./SupplierDirectory", () => ({
  SupplierDirectory: () => <div>Supplier directory</div>,
}))

vi.mock("./SupplierSheet", () => ({
  SupplierSheet: () => <div>Supplier sheet</div>,
}))

vi.mock("./PhotoUploadZone", () => ({
  PhotoUploadZone: () => <div>Photo upload zone</div>,
}))

vi.mock("./ProductCard", () => ({
  ProductCard: () => <div>Product card</div>,
}))

vi.mock("./SourceSheet", () => ({
  SourceSheet: () => <div>Source sheet</div>,
}))

vi.mock("../molecules/SourcesFilter", () => ({
  SourcesFilter: () => <div>Sources filter</div>,
}))

vi.mock("./SourcesTable", () => ({
  SourcesTable: () => <div>Sources table</div>,
}))

vi.mock("../ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  buttonVariants: () => "button-variant",
}))

vi.mock("./MissionSheet", () => ({
  MissionSheet: () => <div>Mission sheet</div>,
}))

vi.mock("./MissionsTable", () => ({
  MissionsTable: () => <div>Missions table</div>,
}))

vi.mock("./CatalogManager", () => ({
  CatalogManager: () => <div>Catalog manager</div>,
}))

describe("UnifiedWorkspace", () => {
  it("renders workspace tabs as links and marks the active section", () => {
    render(
      <UnifiedWorkspace
        activeSection="suppliers"
        isAdmin={true}
        missions={[]}
        inquiries={[]}
        suppliers={[]}
        products={[]}
        sources={[]}
        brands={[]}
        productTypes={[]}
        catalogSummary={{
          totalBrands: 0,
          totalAliases: 0,
          totalProductTypes: 0,
        }}
        catalogPagination={{
          brands: {
            query: "",
            page: 1,
            pageSize: 12,
            totalItems: 0,
            totalPages: 1,
          },
          productTypes: {
            query: "",
            page: 1,
            pageSize: 24,
            totalItems: 0,
            totalPages: 1,
          },
        }}
      />,
    )

    const missionsTab = screen.getByRole("link", { name: /step 1 missions .* autonomous sourcing agents/i })
    const suppliersTab = screen.getByRole("link", { name: /step 3 suppliers .* contacts, trust notes, and brand coverage/i })

    expect(missionsTab).toHaveAttribute("href", "/workspace")
    expect(suppliersTab).toHaveAttribute("href", "/workspace/suppliers")
    expect(suppliersTab).toHaveAttribute("aria-current", "page")
  })

  it("shows read-only catalog messaging for non-admin users", () => {
    render(
      <UnifiedWorkspace
        activeSection="catalog"
        isAdmin={false}
        missions={[]}
        inquiries={[]}
        suppliers={[]}
        products={[]}
        sources={[]}
        brands={[]}
        productTypes={[]}
        catalogSummary={{
          totalBrands: 0,
          totalAliases: 0,
          totalProductTypes: 0,
        }}
        catalogPagination={{
          brands: {
            query: "",
            page: 1,
            pageSize: 12,
            totalItems: 0,
            totalPages: 1,
          },
          productTypes: {
            query: "",
            page: 1,
            pageSize: 24,
            totalItems: 0,
            totalPages: 1,
          },
        }}
      />,
    )

    expect(
      screen.getByText("Browse the shared taxonomy used across sourcing workflows"),
    ).toBeInTheDocument()
  })
})
