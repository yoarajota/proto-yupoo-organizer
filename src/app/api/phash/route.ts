import { NextResponse } from "next/server";
import phash from "sharp-phash";
import { createClient } from "@/lib/supabase/server";
import { getImageBuffer } from "@/lib/supabase/storage";
import { calculateHammingDistance } from "@/lib/phash-utils";

export async function POST(request: Request) {
  try {
    const { storagePath, photoHashId } = await request.json();

    if (!storagePath || !photoHashId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    // 1. Fetch photo from storage
    const buffer = await getImageBuffer(storagePath);

    // 2. Compute pHash
    const computedHash = await phash(buffer);

    // 3. Update database
    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from("photo_hashes")
      .update({ phash: computedHash })
      .eq("id", photoHashId);

    if (updateError) {
      console.error("Failed to update pHash in database:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 4. Similarity Matching (Story 6.2)
    // Fetch existing hashes (excluding the current one) to compare
    const { data: existingHashes, error: fetchError } = await supabase
      .from("photo_hashes")
      .select("id, phash")
      .not("id", "eq", photoHashId)
      .not("phash", "is", null);

    if (fetchError) {
      console.error(
        "Failed to fetch existing hashes for comparison:",
        fetchError.message,
      );
    } else if (existingHashes) {
      const matches = existingHashes
        .map((h) => ({
          matched_photo_hash_id: h.id,
          distance: calculateHammingDistance(computedHash, h.phash!),
        }))
        .filter((m) => m.distance <= 10);

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
          console.error(
            "Failed to insert similarity matches:",
            insertError.message,
          );
        }
      }
    }

    return NextResponse.json({ data: { phash: computedHash }, error: null });
  } catch (error: any) {
    console.error("pHash computation pipeline failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
