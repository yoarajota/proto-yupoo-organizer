import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedActions = vi.hoisted(() => ({
  runMissionDiscovery: vi.fn(),
  runMissionCategoryClassification: vi.fn(),
  reviewMissionCategoryClassification: vi.fn(),
  runMissionMatching: vi.fn(),
  generateOutreachSuggestions: vi.fn(),
}));

vi.mock("@/actions/sourcing-discovery", () => ({
  runMissionDiscovery: mockedActions.runMissionDiscovery,
}));

vi.mock("@/actions/sourcing-classification", () => ({
  runMissionCategoryClassification: mockedActions.runMissionCategoryClassification,
  reviewMissionCategoryClassification: mockedActions.reviewMissionCategoryClassification,
}));

vi.mock("@/actions/sourcing-matching", () => ({
  runMissionMatching: mockedActions.runMissionMatching,
}));

vi.mock("@/actions/sourcing-outreach", () => ({
  generateOutreachSuggestions: mockedActions.generateOutreachSuggestions,
}));

import type { ButtonHTMLAttributes } from "react";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

import { MissionsTable, type MissionRowType } from "./MissionsTable";

describe("MissionsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a card-like mission row with labeled source links", () => {
    const missions: MissionRowType[] = [
      {
        id: "mission-1",
        product_intent: "Find LV bag suppliers with low MOQ",
        seed_url: "https://west42.x.yupoo.com/albums/123?uid=1",
        destination_context: "Brazil marketplace launch",
        status: "classifying_categories",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 2,
        review_items: [],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByText("Find LV bag suppliers with low MOQ")).toBeInTheDocument();
    expect(screen.getByText("Destination Context")).toBeInTheDocument();
    expect(screen.getByText("Brazil marketplace launch")).toBeInTheDocument();
    expect(screen.getByText("2 pending review groups")).toBeInTheDocument();
    expect(screen.getByText("Source Links")).toBeInTheDocument();
    expect(screen.getByText("west42.x.yupoo.com")).toBeInTheDocument();
    expect(screen.getByText("Classifying Categories")).toBeInTheDocument();
  });

  it("derives Yupoo source utility links from the seed URL origin", () => {
    const missions: MissionRowType[] = [
      {
        id: "mission-1",
        product_intent: "LV bags",
        seed_url: "https://west42.x.yupoo.com/albums/123?uid=1",
        destination_context: null,
        status: "created",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 0,
        review_items: [],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByRole("link", { name: /shop root/i })).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/",
    );
    expect(screen.getByRole("link", { name: /seed url/i })).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/albums/123?uid=1",
    );
    expect(screen.getByRole("link", { name: /categories/i })).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/categories",
    );
    expect(screen.getByRole("link", { name: /albums/i })).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/albums",
    );
    expect(screen.getByRole("link", { name: /shop root/i })).toHaveAttribute("target", "_blank");
  });

  it("falls back to the raw seed URL when source parsing fails", () => {
    const missions: MissionRowType[] = [
      {
        id: "mission-1",
        product_intent: "LV bags",
        seed_url: "not a valid url",
        destination_context: null,
        status: "created",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 0,
        review_items: [],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByText("not a valid url")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /shop root/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /seed url/i })).not.toBeInTheDocument();
  });

  it("shows classification as a separate mission step", () => {
    const missions: MissionRowType[] = [
      {
        id: "mission-1",
        product_intent: "LV bags",
        seed_url: "https://west42.x.yupoo.com/",
        destination_context: null,
        status: "classifying_categories",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 0,
        review_items: [],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByRole("button", { name: /run classification/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /run classification/i }));
    expect(mockedActions.runMissionCategoryClassification).toHaveBeenCalledWith({ mission_id: "mission-1" });
  });

  it("preserves mission action visibility and handlers by status", async () => {
    mockedActions.runMissionDiscovery.mockResolvedValueOnce({ data: null, error: null });
    const missions: MissionRowType[] = [
      {
        id: "mission-discovery",
        product_intent: "Discovery",
        seed_url: "https://west42.x.yupoo.com/",
        destination_context: null,
        status: "created",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 0,
        review_items: [],
      },
      {
        id: "mission-matching",
        product_intent: "Matching",
        seed_url: "https://west42.x.yupoo.com/",
        destination_context: null,
        status: "matching",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 0,
        review_items: [],
      },
      {
        id: "mission-outreach",
        product_intent: "Outreach",
        seed_url: "https://west42.x.yupoo.com/",
        destination_context: null,
        status: "suggestions_ready",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 0,
        review_items: [],
      },
    ];

    render(<MissionsTable missions={missions} />);

    fireEvent.click(screen.getByRole("button", { name: /run discovery/i }));
    await waitFor(() => {
      expect(mockedActions.runMissionDiscovery).toHaveBeenCalledWith({ mission_id: "mission-discovery" });
    });

    fireEvent.click(screen.getByRole("button", { name: /run matching/i }));
    expect(mockedActions.runMissionMatching).toHaveBeenCalledWith({
      mission_id: "mission-matching",
      shortlist_limit: 10,
    });

    fireEvent.click(screen.getByRole("button", { name: /generate outreach/i }));
    expect(mockedActions.generateOutreachSuggestions).toHaveBeenCalledWith({
      mission_id: "mission-outreach",
      max_suggestions: 10,
    });
  });

  it("renders review actions for low-confidence category classifications", () => {
    const missions: MissionRowType[] = [
      {
        id: "mission-1",
        product_intent: "LV bags",
        seed_url: "https://west42.x.yupoo.com/",
        destination_context: null,
        status: "classifying_categories",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 1,
        review_items: [
          {
            id: "cat-1",
            mission_id: "mission-1",
            group_key: "mission-1::loui vuiton bags::lv::bags::brand_product_below_strict_threshold",
            raw_label: "Loui Vuiton B4G$",
            normalized_label: "loui vuiton bags",
            display_label: "LV Bags",
            brand_signal: "lv",
            product_signal: "bags",
            classification_confidence: 0.71,
            classification_method: "embedding",
            classification_status: "needs_review",
            decision_reason: "brand_product_below_strict_threshold",
            decision_reason_text: "Brand plus product were detected, but the brand confidence stayed below the balanced repeat threshold.",
            occurrence_count: 1,
            category_ids: ["cat-1"],
            preview_image_urls: [
              "https://west42.x.yupoo.com/preview-1.jpg",
              "https://west42.x.yupoo.com/preview-2.jpg",
            ],
          },
        ],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByText("Loui Vuiton B4G$")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open full preview for loui vuiton b4g\$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /select preview/i })).toHaveLength(2);
    fireEvent.change(screen.getByDisplayValue("lv"), { target: { value: "gucci" } });
    fireEvent.change(screen.getByDisplayValue("bags"), { target: { value: "wallets" } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));

    expect(mockedActions.reviewMissionCategoryClassification).toHaveBeenCalledWith({
      category_id: "cat-1",
      decision: "edit",
      brand: "gucci",
      product: "wallets",
    });
  });

  it("groups duplicate pending review rows into one review card", () => {
    const missions: MissionRowType[] = [
      {
        id: "mission-1",
        product_intent: "LV bags",
        seed_url: "https://west42.x.yupoo.com/",
        destination_context: null,
        status: "classifying_categories",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 1,
        review_items: [
          {
            id: "cat-1",
            mission_id: "mission-1",
            group_key: "group-1",
            raw_label: "designer bags",
            normalized_label: "designer bags",
            display_label: "Bags",
            brand_signal: null,
            product_signal: "bags",
            classification_confidence: 0.76,
            classification_method: "rules",
            classification_status: "needs_review",
            decision_reason: "ambiguous_product_only_label",
            decision_reason_text: "The label contains only a broad product cue, so it stays in manual review.",
            occurrence_count: 2,
            category_ids: ["cat-1", "cat-2"],
            preview_image_urls: [],
          },
        ],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByText(/1 pending review group/i)).toBeInTheDocument();
    expect(screen.getByText(/2 occurrences/i)).toBeInTheDocument();
    expect(screen.getByText(/grouped under/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /accept/i })).toHaveLength(1);
  });

  it("opens the preview lightbox and navigates images", () => {
    const missions: MissionRowType[] = [
      {
        id: "mission-1",
        product_intent: "LV bags",
        seed_url: "https://west42.x.yupoo.com/",
        destination_context: null,
        status: "classifying_categories",
        created_at: "2026-04-23T00:00:00.000Z",
        pending_classifications_count: 1,
        review_items: [
          {
            id: "cat-1",
            mission_id: "mission-1",
            group_key: "group-1",
            raw_label: "designer bags",
            normalized_label: "designer bags",
            display_label: "Bags",
            brand_signal: "lv",
            product_signal: "bags",
            classification_confidence: 0.76,
            classification_method: "rules",
            classification_status: "needs_review",
            decision_reason: "ambiguous_product_only_label",
            decision_reason_text: "The label contains only a broad product cue, so it stays in manual review.",
            occurrence_count: 2,
            category_ids: ["cat-1", "cat-2"],
            preview_image_urls: [
              "https://west42.x.yupoo.com/preview-1.jpg",
              "https://west42.x.yupoo.com/preview-2.jpg",
            ],
          },
        ],
      },
    ];

    render(<MissionsTable missions={missions} />);

    fireEvent.click(screen.getByRole("button", { name: /open full preview for designer bags/i }));
    expect(screen.getByRole("button", { name: /next preview/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next preview/i }));
    expect(screen.getAllByText("2 / 2")).toHaveLength(2);
  });
});
