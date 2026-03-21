import { createClient } from "@/lib/supabase/server"
import { SupplierSheet } from "@/components/organisms/SupplierSheet"
import { Button } from "@/components/ui/button"

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-body-md font-semibold">Suppliers</h1>
        <SupplierSheet trigger={<Button>Add Supplier</Button>} />
      </div>

      <ul className="flex flex-col gap-2">
        {suppliers?.map((supplier) => (
          <li
            key={supplier.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface-container-low px-4 py-3"
          >
            <span className="text-body-sm font-medium">{supplier.name}</span>
            <SupplierSheet
              supplier={supplier}
              trigger={
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              }
            />
          </li>
        ))}
        {(!suppliers || suppliers.length === 0) && (
          <li className="text-body-sm text-muted-foreground py-8 text-center">
            No suppliers yet. Add your first supplier.
          </li>
        )}
      </ul>
    </div>
  )
}
