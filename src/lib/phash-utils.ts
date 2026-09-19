import phash from "sharp-phash";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImageBuffer } from "@/lib/supabase/storage";

const SIMILARITY_MAX_DISTANCE = 10;

/**
 * Calculates the Hamming distance between two hex strings representing perceptual hashes.
 * Assumes strings are of equal length (e.g., 16 characters for a 64-bit hash).
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error("Hashes must have the same length");
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const byte1 = parseInt(hash1[i], 16);
    const byte2 = parseInt(hash2[i], 16);

    // XOR to find differing bits
    let xor = byte1 ^ byte2;

    // Count set bits (popcount)
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

export async function computePhotoHash(
  storagePath: string,
  photoHashId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  try {
    const buffer = await getImageBuffer(supabase, storagePath);
    const computedHash = await phash(buffer);

    const { error: updateError } = await supabase
      .from("photo_hashes")
      .update({ phash: computedHash, phash_status: "hashed" })
      .eq("id", photoHashId);
    if (updateError) throw new Error(updateError.message);

    const { data: existingHashes, error: fetchError } = await supabase
      .from("photo_hashes")
      .select("id, phash")
      .not("id", "eq", photoHashId)
      .not("phash", "is", null);
    if (fetchError) {
      console.error("pHash comparison fetch failed:", fetchError.message);
      return true;
    }

    const matches = (existingHashes ?? [])
      .map((h) => ({
        matched_photo_hash_id: h.id,
        distance: calculateHammingDistance(computedHash, h.phash!),
      }))
      .filter((m) => m.distance <= SIMILARITY_MAX_DISTANCE);

    if (matches.length > 0) {
      const { error: insertError } = await supabase
        .from("similarity_matches")
        .insert(
          matches.map((m) => ({
            source_photo_hash_id: photoHashId,
            matched_photo_hash_id: m.matched_photo_hash_id,
            distance: m.distance,
          })),
        );
      if (insertError) {
        console.error("Failed to insert similarity matches:", insertError.message);
      }
    }
    return true;
  } catch (error) {
    console.error(
      "pHash computation failed:",
      error instanceof Error ? error.message : error,
    );
    await supabase
      .from("photo_hashes")
      .update({ phash_status: "failed" })
      .eq("id", photoHashId);
    return false;
  }
}
