import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ButtonHTMLAttributes } from "react";

const mockedActions = vi.hoisted(() => ({
  runMissionDiscovery: vi.fn(),
  runMissionDiscoveryWithFallback: vi.fn(),
  runMissionCategoryClassification: vi.fn(),
  runMissionCategoryClassificationWithFallback: vi.fn(),
  deleteSourcingMission: vi.fn(),
}));

vi.mock("@/actions/sourcing-discovery", () => ({
  runMissionDiscovery: mockedActions.runMissionDiscovery,
  runMissionDiscoveryWithFallback: mockedActions.runMissionDiscoveryWithFallback,
}));

vi.mock("@/actions/sourcing-missions", () => ({
  deleteSourcingMission: mockedActions.deleteSourcingMission,
}));

vi.mock("@/actions/sourcing-classification", () => ({
  runMissionCategoryClassification: mockedActions.runMissionCategoryClassification,
  runMissionCategoryClassificationWithFallback: mockedActions.runMissionCategoryClassificationWithFallback,
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
    mockedActions.runMissionDiscovery.mockResolvedValue({ data: null, error: null });
    mockedActions.runMissionDiscoveryWithFallback.mockResolvedValue({ data: null, error: null });
    mockedActions.runMissionCategoryClassification.mockResolvedValue({ data: null, error: null });
    mockedActions.runMissionCategoryClassificationWithFallback.mockResolvedValue({ data: null, error: null });
  });

  it("renders scrape missions with source links", () => {
    render(<MissionsTable missions={[makeMission()]} />);

    expect(screen.getAllByText("west42.x.yupoo.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready to scrape").length).toBeGreaterThan(0);
    const [shopRootLink] = screen.getAllByRole("link", { name: /shop root/i });
    expect(shopRootLink).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/",
    );
    const [seedLink] = screen.getAllByRole("link", { name: /seed url/i });
    expect(seedLink).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/albums/123?uid=1",
    );
    const [categoriesLink] = screen.getAllByRole("link", { name: /categories/i });
    expect(categoriesLink).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/categories",
    );
    const [albumsLink] = screen.getAllByRole("link", { name: /albums/i });
    expect(albumsLink).toHaveAttribute(
      "href",
      "https://west42.x.yupoo.com/albums",
    );
  });

  it("runs only the scrape action before a scrape completes", async () => {
    mockedActions.runMissionDiscoveryWithFallback.mockResolvedValueOnce({ data: null, error: null });

    render(<MissionsTable missions={[makeMission()]} />);

    const [runButton] = screen.getAllByRole("button", { name: /run scrape/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(mockedActions.runMissionDiscoveryWithFallback).toHaveBeenCalledWith({ mission_id: "mission-1" });
    });
    expect(mockedActions.runMissionDiscovery).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /run classification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run matching/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate outreach/i })).not.toBeInTheDocument();
  });

  it("runs classification after a scrape completes", async () => {
    mockedActions.runMissionCategoryClassificationWithFallback.mockResolvedValueOnce({ data: null, error: null });

    render(<MissionsTable missions={[makeMission({ status: "completed" })]} />);

    const [runButton] = screen.getAllByRole("button", { name: /run classification/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(mockedActions.runMissionCategoryClassificationWithFallback).toHaveBeenCalledWith({ mission_id: "mission-1" });
    });
    expect(mockedActions.runMissionCategoryClassification).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /run matching/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate outreach/i })).not.toBeInTheDocument();
  });

  it("ignores a second scrape click while a run is in flight", async () => {
    let release!: (value: unknown) => void;
    mockedActions.runMissionDiscoveryWithFallback.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    render(<MissionsTable missions={[makeMission()]} />);

    const [runButton] = screen.getAllByRole("button", { name: /run scrape/i });
    fireEvent.click(runButton);
    fireEvent.click(runButton);
    release({ data: null, error: null });

    await waitFor(() => {
      expect(mockedActions.runMissionDiscoveryWithFallback).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces a scrape-cause error without worker-config text", async () => {
    mockedActions.runMissionDiscoveryWithFallback.mockResolvedValueOnce({
      data: null,
      error: { message: "Every Yupoo discovery request failed." },
    });

    render(<MissionsTable missions={[makeMission()]} />);

    const [runButton] = screen.getAllByRole("button", { name: /run scrape/i });
    fireEvent.click(runButton);

    await screen.findByText(/every request to the yupoo shop failed/i);
    expect(screen.queryByText(/MISSION_WORKER_URL|MISSION_WORKER_TOKEN/i)).not.toBeInTheDocument();
  });

  it("falls back to the raw seed URL when source parsing fails", () => {
    render(<MissionsTable missions={[makeMission({ seed_url: "not a valid url" })]} />);

    expect(screen.getAllByText("not a valid url").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /shop root/i })).not.toBeInTheDocument();
  });

  it("shows admin diagnostics and delete controls", async () => {
    mockedActions.deleteSourcingMission.mockResolvedValueOnce({ data: { id: "mission-1" }, error: null });
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    render(<MissionsTable missions={[makeMission()]} isAdmin />);

    const [diagnosticsLink] = screen.getAllByRole("link", { name: /diagnostics/i });
    expect(diagnosticsLink).toHaveAttribute(
      "href",
      "/missions/mission-1",
    );

    const [deleteButton] = screen.getAllByRole("button", { name: /delete mission/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockedActions.deleteSourcingMission).toHaveBeenCalledWith("mission-1");
    });
  });
});
