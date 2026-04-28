"use client"

import { useState, useTransition } from "react"
import { createBrand, createProductType } from "@/actions/catalog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { CatalogOption } from "@/lib/catalog"

type CatalogManagerProps = {
  brands: CatalogOption[]
  productTypes: CatalogOption[]
}

export function CatalogManager({ brands, productTypes }: CatalogManagerProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CatalogPanel
        title="Brands"
        description="Register brand names once, then link them to products and suppliers."
        items={brands}
        placeholder="e.g. Nike"
        submitLabel="Add Brand"
        onCreate={createBrand}
      />
      <CatalogPanel
        title="Product Types"
        description="Register reusable product types like bags, jackets, shoes, and watches."
        items={productTypes}
        placeholder="e.g. Bags"
        submitLabel="Add Type"
        onCreate={createProductType}
      />
    </div>
  )
}

type CatalogPanelProps = {
  title: string
  description: string
  items: CatalogOption[]
  placeholder: string
  submitLabel: string
  onCreate: (values: { name: string }) => Promise<{
    data: unknown
    error: { message: string } | null
  }>
}

function CatalogPanel({
  title,
  description,
  items,
  placeholder,
  submitLabel,
  onCreate,
}: CatalogPanelProps) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await onCreate({ name })

      if (result.error) {
        setError(result.error.message)
        return
      }

      setName("")
    })
  }

  return (
    <Card className="rounded-none shadow-none">
      <CardHeader>
        <CardTitle className="text-body-md">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
          />
          <Button type="submit" disabled={isPending || name.trim().length === 0}>
            {isPending ? "Adding..." : submitLabel}
          </Button>
        </form>
        {error && <p className="text-label-xs text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">No entries yet.</p>
          ) : (
            items.map((item) => (
              <Badge key={item.id} variant="outline">
                {item.name}
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
