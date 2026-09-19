import { NextResponse } from "next/server";
import phash from "sharp-phash";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImageBuffer } from "@/lib/supabase/storage";
import { calculateHammingDistance } from "@/lib/phash-utils";

function isAuthorized(request: Request) {
  const token = process.env.PHASH_WORKER_TOKEN;
  const authorization = request.headers.get("authorization");

  if (!token || !authorization) return false;
  return authorization === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let failedPhotoHashId: string | undefined;
  try {
    const { storagePath, photoHashId } = await request.json();

    if (!storagePath || !photoHashId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }
    const photoHashIdValue: string = photoHashId;
    failedPhotoHashId = photoHashIdValue;

    // 1. Fetch photo from storage
    const buffer = await getImageBuffer(createAdminClient(), storagePath);

    // 2. Compute pHash
    const computedHash = await phash(buffer);

    // 3. Update database
    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from("photo_hashes")
      .update({ phash: computedHash, phash_status: "hashed" })
      .eq("id", photoHashIdValue);

    if (updateError) {
      console.error("Failed to update pHash in database:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 4. Similarity Matching (Story 6.2)
    // Fetch existing hashes (excluding the current one) to compare
    const { data: existingHashes, error: fetchError } = await supabase
      .from("photo_hashes")
      .select("id, phash")
      .not("id", "eq", photoHashIdValue)
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
              source_photo_hash_id: photoHashIdValue,
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
    if (failedPhotoHashId) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from("photo_hashes")
          .update({ phash_status: "failed" })
          .eq("id", failedPhotoHashId);
      } catch {
        // best effort: the row stays pending for a later retry
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
