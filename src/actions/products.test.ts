import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProduct, retryPendingPhotoHashes } from "./products";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const computePhotoHash = vi.hoisted(() => vi.fn());
vi.mock("@/lib/phash-utils", () => ({ computePhotoHash }));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Product Actions - pHash pending + retry", () => {
  const inserts: unknown[] = [];

  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    inserts.length = 0;
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "products") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "prod-1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "photo_hashes") {
        return {
          insert: (row: unknown) => {
            inserts.push(row);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: "hash-1",
                      storage_path: "products/x-photo.jpg",
                      phash_status: "pending",
                    },
                    error: null,
                  }),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    { id: "hash-1", storage_path: "products/x-photo.jpg" },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
  });

  afterEach(() => {
    computePhotoHash.mockReset();
  });

  it("leaves a pending row when the pHash trigger cannot run", async () => {
    computePhotoHash.mockResolvedValue(false);

    const { data, error } = await createProduct(
      "products/x-photo.jpg",
      "photo.jpg",
    );

    expect(error).toBeNull();
    expect(data?.hash.id).toBe("hash-1");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      download_status: "downloaded",
      phash_status: "pending",
    });
    expect(computePhotoHash).toHaveBeenCalledWith("products/x-photo.jpg", "hash-1");
  });

  it("recovers the pending row once the trigger works again", async () => {
    computePhotoHash.mockResolvedValue(true);

    const { data, error } = await retryPendingPhotoHashes();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      pending_found: 1,
      trigger_requested: 1,
      trigger_failed: 0,
    });
    expect(computePhotoHash).toHaveBeenCalledWith("products/x-photo.jpg", "hash-1");
  });
});
