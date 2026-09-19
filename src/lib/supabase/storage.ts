import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetches an image from Supabase Storage as a Buffer.
 * @param supabase Client allowed to read the bucket (service role for background work).
 * @param storagePath The path to the file in the 'product-photos' bucket.
 * @returns Buffer of the image data.
 * @throws Error if the fetch fails or user is unauthorized.
 */
export async function getImageBuffer(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from("product-photos")
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download image from storage: ${error.message}`);
  }

  if (!data) {
    throw new Error("Image data is empty");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
