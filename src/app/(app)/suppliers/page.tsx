import { createClient } from "@/lib/supabase/server";
import { SupplierSheet } from "@/components/organisms/SupplierSheet";
import { SupplierDirectory } from "@/components/organisms/SupplierDirectory";
import { Button } from "@/components/ui/button";
import { DetailTemplate } from "@/components/templates/DetailTemplate";

export default async function SuppliersPage() {
  const supabase = await createClient();
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

  return (
    <DetailTemplate
      title="Direct Suppliers"
      breadcrumb={<span>Registry</span>}
      sideContent={
        <div className="p-8 bg-foreground/5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-40">Add Entry</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Record a new direct factory or primary wholesale contact to track your sourcing network.
          </p>
          <SupplierSheet 
            trigger={
              <Button className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-none h-12 uppercase tracking-widest text-[10px] font-bold">
                Create Supplier Card
              </Button>
            } 
          />
        </div>
      }
    >
      <SupplierDirectory
        suppliers={supplierStats}
        allBrands={allBrands}
      />
    </DetailTemplate>
  );
}
