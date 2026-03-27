import { createClient } from "@/lib/supabase/server";
import { SupplierSheet } from "@/components/organisms/SupplierSheet";
import { SupplierDirectory } from "@/components/organisms/SupplierDirectory";
import { Button } from "@/components/ui/button";

export default async function SuppliersPage() {
  const supabase = await createClient();

  // inquiries table is correctly typed now
  const db = supabase;

  const [
    { data: suppliers },
    { data: inquiriesWithPrice },
    { data: activeInquiries },
  ] = await Promise.all([
    db.from("suppliers").select("*").order("created_at", { ascending: false }),
    db.from("inquiries").select("supplier_id, price").not("price", "is", null),
    db
      .from("inquiries")
      .select("supplier_id, status")
      .in("status", ["sent", "price_received", "negotiating"]),
  ]);

  const supplierList = suppliers ?? [];
  const priceRows = inquiriesWithPrice ?? [];
  const activeRows = activeInquiries ?? [];

  const supplierStats = supplierList.map((s) => {
    const supplierInquiries = priceRows.filter(
      (i) => i && i.supplier_id === s.id && i.price !== null,
    );
    const prices = supplierInquiries.map((i) => i.price as number);
    const activeCount = activeRows.filter(
      (i) => i && i.supplier_id === s.id,
    ).length;
    return {
      ...s,
      priceRange:
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : undefined,
      activeInquiryCount: activeCount,
    };
  });

  const allBrands = [...new Set(supplierList.flatMap((s) => s.brands))].sort();

  const addSupplierTrigger = (
    <SupplierSheet trigger={<Button>Add Supplier</Button>} />
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-body-md font-semibold">Suppliers</h1>
        <SupplierSheet trigger={<Button>Add Supplier</Button>} />
      </div>
      <SupplierDirectory
        suppliers={supplierStats}
        allBrands={allBrands}
        addSupplierTrigger={addSupplierTrigger}
      />
    </div>
  );
}
