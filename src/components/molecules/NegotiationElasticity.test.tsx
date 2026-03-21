import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { NegotiationElasticity } from "./NegotiationElasticity"

describe("NegotiationElasticity", () => {
  it("renders 'No elasticity data' when both prices are null", () => {
    render(<NegotiationElasticity openingPrice={null} finalPrice={null} />)
    expect(screen.getByText("No elasticity data")).toBeInTheDocument()
  })

  it("renders 'No elasticity data' when only one price is provided", () => {
    render(<NegotiationElasticity openingPrice={100} finalPrice={null} />)
    expect(screen.getByText("No elasticity data")).toBeInTheDocument()
  })

  it("renders opening and final prices formatted as BRL", () => {
    render(<NegotiationElasticity openingPrice={100} finalPrice={90} />)
    expect(screen.getByText(/R\$\s*100/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*90/)).toBeInTheDocument()
  })

  it("shows negative percentage with error styling when final < opening", () => {
    const { container } = render(<NegotiationElasticity openingPrice={100} finalPrice={80} />)
    const pctSpan = container.querySelector(".text-error")
    expect(pctSpan).toBeInTheDocument()
    expect(pctSpan?.textContent).toMatch(/-20%/)
  })

  it("shows positive percentage with primary styling when final > opening", () => {
    const { container } = render(<NegotiationElasticity openingPrice={80} finalPrice={100} />)
    const pctSpan = container.querySelector(".text-primary")
    expect(pctSpan).toBeInTheDocument()
    expect(pctSpan?.textContent).toMatch(/\+25%/)
  })
})
