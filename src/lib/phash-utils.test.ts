import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateHammingDistance, computePhotoHash } from "./phash-utils";

const mocks = vi.hoisted(() => ({
  phash: vi.fn(),
  getImageBuffer: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("sharp-phash", () => ({ default: mocks.phash }));
vi.mock("@/lib/supabase/storage", () => ({ getImageBuffer: mocks.getImageBuffer }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

describe("phash-utils", () => {
  describe("calculateHammingDistance", () => {
    it("should return 0 for identical hashes", () => {
      const hash = "ffffffffffffffff";
      expect(calculateHammingDistance(hash, hash)).toBe(0);
    });

    it("should return correct distance for different hashes", () => {
      const hash1 = "0000000000000000";
      const hash2 = "0000000000000001"; // 1 bit different
      expect(calculateHammingDistance(hash1, hash2)).toBe(1);

      const hash3 = "0000000000000003"; // 2 bits different (0011)
      expect(calculateHammingDistance(hash1, hash3)).toBe(2);

      const hash4 = "ffffffffffffffff"; // all 64 bits different
      expect(calculateHammingDistance(hash1, hash4)).toBe(64);
    });

    it("should handle hex characters correctly", () => {
      const hash1 = "a"; // 1010
      const hash2 = "5"; // 0101
      // All 4 bits are different
      expect(calculateHammingDistance(hash1, hash2)).toBe(4);
    });

    it("should throw error if lengths differ", () => {
      expect(() => calculateHammingDistance("abc", "abcd")).toThrow(
        "Hashes must have the same length",
      );
    });
  });
});

describe("computePhotoHash", () => {
  const updates: unknown[] = [];
  const inserts: unknown[] = [];

  function makeClient(existing: Array<{ id: string; phash: string }>) {
    return {
      from: (table: string) => {
        if (table === "similarity_matches") {
          return {
            insert: (rows: unknown) => {
              inserts.push(rows);
              return Promise.resolve({ error: null });
            },
          };
        }
        return {
          update: (row: unknown) => {
            updates.push(row);
            return { eq: () => Promise.resolve({ error: null }) };
          },
          select: () => ({
            not: () => ({
              not: () => Promise.resolve({ data: existing, error: null }),
            }),
          }),
        };
      },
    };
  }

  beforeEach(() => {
    updates.length = 0;
    inserts.length = 0;
    mocks.phash.mockReset();
    mocks.getImageBuffer.mockReset();
    mocks.getImageBuffer.mockResolvedValue(Buffer.from("img"));
  });

  it("stores the hash and records matches within distance 10", async () => {
    mocks.phash.mockResolvedValue("0000000000000000");
    mocks.createAdminClient.mockReturnValue(
      makeClient([
        { id: "near", phash: "0000000000000001" },
        { id: "far", phash: "ffffffffffffffff" },
      ]),
    );

    expect(await computePhotoHash("p.jpg", "h1")).toBe(true);
    expect(updates).toEqual([{ phash: "0000000000000000", phash_status: "hashed" }]);
    expect(inserts).toEqual([
      [{ source_photo_hash_id: "h1", matched_photo_hash_id: "near", distance: 1 }],
    ]);
  });

  it("marks the row failed and returns false when hashing throws", async () => {
    mocks.phash.mockRejectedValue(new Error("bad image"));
    mocks.createAdminClient.mockReturnValue(makeClient([]));

    expect(await computePhotoHash("p.jpg", "h1")).toBe(false);
    expect(updates).toEqual([{ phash_status: "failed" }]);
  });
});
