import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProduct, retryPendingPhotoHashes } from "./products";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Product Actions - pHash pending + retry", () => {
  const oldAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const oldPhashToken = process.env.PHASH_WORKER_TOKEN;
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
    vi.unstubAllGlobals();
    if (oldAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = oldAppUrl;
    if (oldPhashToken === undefined) delete process.env.PHASH_WORKER_TOKEN;
    else process.env.PHASH_WORKER_TOKEN = oldPhashToken;
  });

  it("leaves a pending row when the pHash trigger cannot run", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

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
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("recovers the pending row once the trigger works again", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.PHASH_WORKER_TOKEN = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { data, error } = await retryPendingPhotoHashes();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      pending_found: 1,
      trigger_requested: 1,
      trigger_failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.example.com/api/phash",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
