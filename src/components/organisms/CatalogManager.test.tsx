import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CatalogManager } from "./CatalogManager"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/workspace/catalog"),
  useRouter: vi.fn(() => ({
    push: pushMock,
  })),
}))

vi.mock("@/actions/catalog", () => ({
  createBrand: vi.fn(),
  createBrandAlias: vi.fn(),
  createProductType: vi.fn(),
}))

const brands = [
  {
    id: "brand-1",
    name: "Prada",
    slug: "prada",
    brand_aliases: [
      {
        id: "alias-1",
        alias: "PRA*DA*",
      },
    ],
  },
]

const productTypes = [
  {
    id: "type-1",
    name: "Bags",
    slug: "bags",
  },
]

const summary = {
  totalBrands: 89,
  totalAliases: 283,
  totalProductTypes: 297,
}

const pagination = {
  brands: {
    query: "",
    page: 2,
    pageSize: 12,
    totalItems: 89,
    totalPages: 8,
  },
  productTypes: {
    query: "",
    page: 1,
    pageSize: 24,
    totalItems: 297,
    totalPages: 13,
  },
}

const searchState = {
  brandQuery: "",
  brandPage: 2,
  productTypeQuery: "",
  productTypePage: 1,
}

describe("CatalogManager", () => {
  it("shows editable controls for admins", () => {
    render(
      <CatalogManager
        brands={brands}
        productTypes={productTypes}
        isAdmin={true}
        summary={summary}
        pagination={pagination}
        searchState={searchState}
      />,
    )

    expect(screen.getByText("Admin access enabled")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "e.g. Prada" })).toBeEnabled()
    expect(screen.getByRole("textbox", { name: "e.g. Bags" })).toBeEnabled()
    expect(screen.queryByRole("textbox", { name: "Brand alias" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "More" }))

    expect(screen.getByRole("textbox", { name: "Brand alias" })).toBeEnabled()
  })

  it("shows a read-only catalog view for non-admins", () => {
    render(
      <CatalogManager
        brands={brands}
        productTypes={productTypes}
        isAdmin={false}
        summary={summary}
        pagination={pagination}
        searchState={searchState}
      />,
    )

    expect(screen.getByText("Read-only catalog access")).toBeInTheDocument()
    expect(
      screen.getByText("You can inspect the shared catalog, but only admins can add or edit taxonomy values."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Brand" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add Type" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    expect(screen.getByRole("button", { name: "Add Alias" })).toBeDisabled()
  })

  it("builds pagination links from server state", () => {
    render(
      <CatalogManager
        brands={brands}
        productTypes={productTypes}
        isAdmin={false}
        summary={summary}
        pagination={pagination}
        searchState={searchState}
      />,
    )

    const previousLinks = screen.getAllByRole("link", { name: /previous/i })
    expect(previousLinks[0]).toHaveAttribute("href", "/workspace/catalog")

    const nextLinks = screen.getAllByRole("link", { name: /next/i })
    expect(nextLinks[0]).toHaveAttribute("href", "/workspace/catalog?brandPage=3")
  })

  it("submits brand searches through query params", () => {
    render(
      <CatalogManager
        brands={brands}
        productTypes={productTypes}
        isAdmin={false}
        summary={summary}
        pagination={pagination}
        searchState={searchState}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText("Search brands or aliases"), {
      target: { value: "gucci" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0])

    expect(pushMock).toHaveBeenCalledWith("/workspace/catalog?brandQuery=gucci")
  })

  it("collapses secondary brand details behind a more control", () => {
    render(
      <CatalogManager
        brands={[
          {
            id: "brand-1",
            name: "Prada",
            slug: "prada",
            brand_aliases: [
              { id: "alias-1", alias: "A1" },
              { id: "alias-2", alias: "A2" },
              { id: "alias-3", alias: "A3" },
              { id: "alias-4", alias: "A4" },
              { id: "alias-5", alias: "A5" },
            ],
          },
        ]}
        productTypes={productTypes}
        isAdmin={true}
        summary={summary}
        pagination={pagination}
        searchState={searchState}
      />,
    )

    expect(screen.queryByRole("textbox", { name: "Brand alias" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "More" }))

    expect(screen.getByRole("textbox", { name: "Brand alias" })).toBeInTheDocument()
    expect(screen.getByText("A5")).toBeInTheDocument()
  })
})
