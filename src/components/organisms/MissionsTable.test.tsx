import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ButtonHTMLAttributes } from "react";

const mockedActions = vi.hoisted(() => ({
  runMissionDiscovery: vi.fn(),
  runMissionCategoryClassification: vi.fn(),
  deleteSourcingMission: vi.fn(),
}));

vi.mock("@/actions/sourcing-discovery", () => ({
  runMissionDiscovery: mockedActions.runMissionDiscovery,
}));

vi.mock("@/actions/sourcing-missions", () => ({
  deleteSourcingMission: mockedActions.deleteSourcingMission,
}));

vi.mock("@/actions/sourcing-classification", () => ({
  runMissionCategoryClassification: mockedActions.runMissionCategoryClassification,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

import { MissionsTable, type MissionRowType } from "./MissionsTable";

function makeMission(overrides: Partial<MissionRowType> = {}): MissionRowType {
  return {
    id: "mission-1",
    product_intent: "Yupoo scrape: west42.x.yupoo.com",
    seed_url: "https://west42.x.yupoo.com/albums/123?uid=1",
    destination_context: null,
    status: "created",
    created_at: "2026-04-23T00:00:00.000Z",
    pending_classifications_count: 0,
    review_items: [],
    ...overrides,
  };
}

describe("MissionsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders scrape missions with source links", () => {
    render(<MissionsTable missions={[makeMission()]} />);

    expect(screen.getByText("west42.x.yupoo.com")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
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
  });

  it("runs only the scrape action before a scrape completes", async () => {
    mockedActions.runMissionDiscovery.mockResolvedValueOnce({ data: null, error: null });

    render(<MissionsTable missions={[makeMission()]} />);

    fireEvent.click(screen.getByRole("button", { name: /run scrape/i }));

    await waitFor(() => {
      expect(mockedActions.runMissionDiscovery).toHaveBeenCalledWith({ mission_id: "mission-1" });
    });
    expect(screen.queryByRole("button", { name: /run classification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run matching/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate outreach/i })).not.toBeInTheDocument();
  });

  it("runs classification after a scrape completes", async () => {
    mockedActions.runMissionCategoryClassification.mockResolvedValueOnce({ data: null, error: null });

    render(<MissionsTable missions={[makeMission({ status: "completed" })]} />);

    fireEvent.click(screen.getByRole("button", { name: /run classification/i }));

    await waitFor(() => {
      expect(mockedActions.runMissionCategoryClassification).toHaveBeenCalledWith({ mission_id: "mission-1" });
    });
    expect(screen.queryByRole("button", { name: /run matching/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate outreach/i })).not.toBeInTheDocument();
  });

  it("falls back to the raw seed URL when source parsing fails", () => {
    render(<MissionsTable missions={[makeMission({ seed_url: "not a valid url" })]} />);

    expect(screen.getByText("not a valid url")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /shop root/i })).not.toBeInTheDocument();
  });

  it("shows admin diagnostics and delete controls", async () => {
    mockedActions.deleteSourcingMission.mockResolvedValueOnce({ data: { id: "mission-1" }, error: null });
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    render(<MissionsTable missions={[makeMission()]} isAdmin />);

    expect(screen.getByRole("link", { name: /diagnostics/i })).toHaveAttribute(
      "href",
      "/missions/mission-1",
    );

    fireEvent.click(screen.getByRole("button", { name: /delete mission/i }));

    await waitFor(() => {
      expect(mockedActions.deleteSourcingMission).toHaveBeenCalledWith("mission-1");
    });
  });
});
