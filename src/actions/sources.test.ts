import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable builder factory
function makeBuilder(terminalValue: any) {
  const builder: any = {};
  const chainMethods = [
    "select",
    "eq",
    "insert",
    "update",
    "upsert",
    "delete",
    "not",
    "order",
    "in",
  ];
  chainMethods.forEach((m) => {
    builder[m] = () => builder;
  });

  builder.single = () => {
    if (
      terminalValue &&
      (terminalValue.data !== undefined || terminalValue.error !== undefined)
    ) {
      return Promise.resolve(terminalValue);
    }
    return Promise.resolve({ data: terminalValue, error: null });
  };

  builder.then = (onfulfilled: any) =>
    Promise.resolve(terminalValue).then(onfulfilled);

  return builder;
}

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { createSource, toggleSourceActive } = await import("./sources");

describe("createSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when validation fails (invalid URL)", async () => {
    const result = await createSource({
      url: "not-a-url",
      platform: "reddit",
      brands: [],
      notes: null,
    });

    expect(result.error).toBeDefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await createSource({
      url: "https://reddit.com/r/repsneakers",
      platform: "reddit",
      brands: ["nike"],
      notes: "some notes",
    });

    expect(result).toEqual({ data: null, error: { message: "Unauthorized" } });
  });

  it("returns { data, error: null } on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } });
    const fakeSource = { id: "src1", url: "https://reddit.com/r/repsneakers" };
    mockFrom.mockReturnValue(makeBuilder({ data: fakeSource, error: null }));

    const result = await createSource({
      url: "https://reddit.com/r/repsneakers",
      platform: "reddit",
      brands: ["nike"],
      notes: "some notes",
    });

    expect(result).toEqual({ data: fakeSource, error: null });
    expect(mockFrom).toHaveBeenCalledWith("sources");
  });
});

describe("toggleSourceActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await toggleSourceActive("src1", false);

    expect(result).toEqual({ data: null, error: { message: "Unauthorized" } });
  });

  it("returns { data, error: null } on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } });
    const fakeSource = { id: "src1", is_active: false };
    mockFrom.mockReturnValue(makeBuilder({ data: fakeSource, error: null }));

    const result = await toggleSourceActive("src1", false);

    expect(result).toEqual({ data: fakeSource, error: null });
    expect(mockFrom).toHaveBeenCalledWith("sources");
  });
});
