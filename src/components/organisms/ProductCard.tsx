import Link from "next/link";
import { Camera, AlertCircle } from "lucide-react";
import { PhotoThumb } from "@/components/atoms/PhotoThumb";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type PhotoHashRow = Database["public"]["Tables"]["photo_hashes"]["Row"];

interface ProductCardProps {
  product: ProductRow & {
    photo_hashes: (PhotoHashRow & {
      similarity_matches?: { is_dismissed: boolean }[];
    })[];
  };
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const firstPhoto = product.photo_hashes[0];
  const publicUrl = firstPhoto
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/${firstPhoto.storage_path}`
    : null;

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(product.created_at));

  const hasMatches = product.photo_hashes.some((ph) =>
    ph.similarity_matches?.some((m) => !m.is_dismissed)
  );

  return (
    <Link
      href={`/products/${product.id}`}
      className={cn("group block perspective-1000", className)}
    >
      <div className="flex flex-col gap-4 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-y-[-4px]">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted/20">
          {hasMatches && (
            <div className="absolute top-4 left-4 z-10 px-2 py-1 bg-primary text-[8px] uppercase tracking-tighter font-bold text-background animate-pulse">
              Duplicate Found
            </div>
          )}
          {publicUrl ? (
            <PhotoThumb
              src={publicUrl}
              alt={firstPhoto?.alt_text || "Product photo"}
              size="lg"
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center border border-foreground/5">
              <Camera className="text-muted-foreground/30" size={32} strokeWidth={1} />
            </div>
          )}
          <div className="absolute inset-0 bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-multiply" />
        </div>

        <div className="space-y-1.5 px-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-foreground/90 line-clamp-1">
              {product.notes || "Unnamed Reference"}
            </h3>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
              Ref. {product.id.slice(0, 5)}
            </span>
          </div>
          
          <div className="flex items-center justify-between border-t border-foreground/5 pt-2">
            <span className="text-[10px] italic text-muted-foreground/70">
              {formattedDate}
            </span>
            <span className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-tighter">
              {product.photo_hashes.length} {product.photo_hashes.length === 1 ? "Image" : "Images"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
