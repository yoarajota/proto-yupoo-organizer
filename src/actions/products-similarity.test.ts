import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSimilarityMatches, dismissSimilarityMatch } from "./products";
import { createClient } from "@/lib/supabase/server";

// Mock Supabase client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Product Actions - Similarity", () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });
  });

  describe("getSimilarityMatches", () => {
    it("should return matches for a product", async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === "photo_hashes") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({ data: [{ id: "hash-1" }], error: null }),
            }),
          };
        }
        if (table === "similarity_matches") {
          return {
            select: () => ({
              in: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ id: "match-1", distance: 5 }],
                    error: null,
                  }),
              }),
            }),
          };
        }
        return mockSupabase;
      });

      const { data, error } = await getSimilarityMatches("prod-123");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe("match-1");
    });
  });

  describe("dismissSimilarityMatch", () => {
    it("should dismiss a match", async () => {
      mockSupabase.from.mockImplementation(() => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "match-1" }, error: null }),
            }),
          }),
        }),
      }));

      const { data, error } = await dismissSimilarityMatch("match-1");
      expect(error).toBeNull();
      expect(data.id).toBe("match-1");
    });
  });
});
