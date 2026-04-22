"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProductUpdateValues } from "@/lib/schemas/product";

export async function createProduct(storagePath: string, altText: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({ created_by: user.id })
    .select()
    .single();

  if (productError || !product) {
    return {
      data: null,
      error: { message: productError?.message ?? "Failed to create product" },
    };
  }

  const { data: hash, error: hashError } = await supabase
    .from("photo_hashes")
    .insert({
      product_id: product.id,
      storage_path: storagePath,
      alt_text: altText,
      created_by: user.id,
    })
    .select()
    .single();

  if (hashError) {
    await supabase.storage.from("product-photos").remove([storagePath]);
    return { data: null, error: { message: hashError.message } };
  }

  // Trigger pHash computation (non-blocking)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/phash`, {
    method: "POST",
    body: JSON.stringify({
      storagePath: hash.storage_path,
      photoHashId: hash.id,
    }),
    keepalive: true,
  }).catch((err) => console.error("Failed to trigger pHash computation:", err));

  revalidatePath("/workspace");
  return { data: { product, hash }, error: null };
}

export async function addProductPhoto(
  productId: string,
  storagePath: string,
  altText: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data: hash, error: hashError } = await supabase
    .from("photo_hashes")
    .insert({
      product_id: productId,
      storage_path: storagePath,
      alt_text: altText,
      created_by: user.id,
    })
    .select()
    .single();

  if (hashError) {
    await supabase.storage.from("product-photos").remove([storagePath]);
    return { data: null, error: { message: hashError.message } };
  }

  // Trigger pHash computation (non-blocking)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/phash`, {
    method: "POST",
    body: JSON.stringify({
      storagePath: hash.storage_path,
      photoHashId: hash.id,
    }),
    keepalive: true,
  }).catch((err) => console.error("Failed to trigger pHash computation:", err));

  revalidatePath("/workspace");
  revalidatePath(`/products/${productId}`);
  return { data: hash, error: null };
}

export async function updateProduct(
  productId: string,
  values: ProductUpdateValues,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data, error } = await supabase
    .from("products")
    .update({ notes: values.notes })
    .eq("id", productId)
    .select()
    .single();

  if (error) return { data: null, error: { message: error.message } };
  if (!data)
    return {
      data: null,
      error: {
        message: "Permission denied — only the product creator can edit notes",
      },
    };
  // Note: updated_at auto-set by products_updated_at trigger (DO NOT manually set it)
  revalidatePath("/workspace");
  revalidatePath(`/products/${productId}`);
  return { data, error: null };
}

export async function getSimilarityMatches(productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  // 1. Fetch all photo hashes for this product
  const { data: hashes, error: hashError } = await supabase
    .from("photo_hashes")
    .select("id")
    .eq("product_id", productId);

  if (hashError || !hashes) {
    return {
      data: null,
      error: { message: hashError?.message || "Product photos not found" },
    };
  }

  const hashIds = hashes.map((h) => h.id);

  // 2. Fetch undismissed matches where any of the product's photos is the source
  // We join with the matched photo -> product -> inquiries -> supplier
  const { data: matches, error: matchError } = await supabase
    .from("similarity_matches")
    .select(
      `
      *,
      matched_photo:photo_hashes!matched_photo_hash_id (
        id,
        product:products (
          id,
          inquiries (
            supplier:suppliers (
              id,
              name
            )
          )
        )
      )
    `,
    )
    .in("source_photo_hash_id", hashIds)
    .eq("is_dismissed", false);

  if (matchError) {
    return { data: null, error: { message: matchError.message } };
  }

  return { data: matches, error: null };
}

export async function dismissSimilarityMatch(matchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Unauthorized" } };

  const { data, error } = await supabase
    .from("similarity_matches")
    .update({ is_dismissed: true })
    .eq("id", matchId)
    .select("id")
    .single();

  if (error) return { data: null, error: { message: error.message } };

  // Note: RLS ensures only the creator can update is_dismissed
  if (!data) {
    return {
      data: null,
      error: { message: "Permission denied or match not found" },
    };
  }

  revalidatePath("/workspace");
  // Ideally revalidate the specific product page, but we'd need its ID.
  // The client can call revalidate if needed, or we can just revalidate all.

  return { data, error: null };
}
