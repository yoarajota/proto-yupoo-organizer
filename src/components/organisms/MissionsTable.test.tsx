import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
          },
        ],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByText("Loui Vuiton B4G$")).toBeInTheDocument();
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
          },
        ],
      },
    ];

    render(<MissionsTable missions={missions} />);

    expect(screen.getByText(/1 pending review group/i)).toBeInTheDocument();
    expect(screen.getByText(/2 occurrences grouped under designer bags/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /accept/i })).toHaveLength(1);
  });
});
