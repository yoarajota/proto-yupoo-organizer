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

const { createInquiry, updateInquiry, deleteInquiry } =
  await import("./inquiries");

// Real UUIDs for Zod validation
const VALID_PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_SUPPLIER_ID = "550e8400-e29b-41d4-a716-446655440001";

describe("createInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when validation fails", async () => {
    const result = await createInquiry({
      product_id: "not-a-uuid",
      supplier_id: VALID_SUPPLIER_ID,
      status: "sent",
    });

    expect(result.error).toBeDefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await createInquiry({
      product_id: VALID_PRODUCT_ID,
      supplier_id: VALID_SUPPLIER_ID,
      status: "sent",
    });

    expect(result).toEqual({ data: null, error: { message: "Unauthorized" } });
  });

  it("returns { data, error: null } on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } });
    const fakeInquiry = { id: "inq1", product_id: VALID_PRODUCT_ID };
    mockFrom.mockReturnValue(makeBuilder({ data: fakeInquiry, error: null }));

    const result = await createInquiry({
      product_id: VALID_PRODUCT_ID,
      supplier_id: VALID_SUPPLIER_ID,
      status: "sent",
    });

    expect(result).toEqual({ data: fakeInquiry, error: null });
  });
});

describe("updateInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { data, error: null } on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } });
    const updated = {
      id: "inq1",
      product_id: VALID_PRODUCT_ID,
      status: "price_received",
    };
    mockFrom.mockReturnValue(makeBuilder({ data: updated, error: null }));

    const result = await updateInquiry("inq1", {
      status: "price_received",
    });

    expect(result).toEqual({ data: updated, error: null });
  });
});

describe("deleteInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error on failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } });

    mockFrom.mockReturnValueOnce(
      makeBuilder({ data: { product_id: VALID_PRODUCT_ID }, error: null }),
    );
    mockFrom.mockReturnValueOnce(
      makeBuilder({ data: null, error: { message: "Delete failed" } }),
    );

    const result = await deleteInquiry("inq1");

    expect(result).toEqual({ error: { message: "Delete failed" } });
  });

  it("returns { error: null } on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user1" } } });

    mockFrom.mockReturnValueOnce(
      makeBuilder({ data: { product_id: VALID_PRODUCT_ID }, error: null }),
    );
    mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: null }));

    const result = await deleteInquiry("inq1");

    expect(result).toEqual({ error: null });
  });
});
