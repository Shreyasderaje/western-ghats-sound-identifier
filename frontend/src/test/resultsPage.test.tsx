import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Results from "../pages/Results";
import { MOCK_RESULTS } from "../services/mockData";
import type { ResultsResponse } from "../types";

const getResultsMock = vi.fn();

vi.mock("../services/api", () => ({
  getResults: (...args: unknown[]) => getResultsMock(...args),
  getSpectrogramUrl: (id: string) => `http://localhost:5000/api/spectrogram/${id}`,
}));

function renderResults(payload: ResultsResponse) {
  getResultsMock.mockResolvedValue(payload);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/results/demo0001"]}>
        <Routes>
          <Route path="/results/:fileId" element={<Results />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Results page", () => {
  it("renders the completed analysis: summary, species, timeline, actions", async () => {
    renderResults(MOCK_RESULTS);

    expect(await screen.findByText("agumbe_dawn.wav")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument(); // unique species card
    expect(screen.getByText(/malabar grey hornbill/i)).toBeInTheDocument();
    expect(screen.getByText(/detection timeline/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pdf report/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /csv export/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /confidence threshold/i })).toBeInTheDocument();
  });

  it("shows the in-progress state while processing", async () => {
    renderResults({
      status: "processing",
      results: {
        recording: {
          file_id: "x", filename: "x.wav", upload_date: null, duration: null,
          location: null, latitude: null, longitude: null, sample_rate: null,
          quality_score: null, quality_label: null, is_public: false, username: null,
        },
        summary: {
          total_detections: 0, unique_species: 0, birds: 0, frogs: 0,
          shannon_diversity: 0, recording_duration: null, per_species: [],
        },
        detections: [],
        spectrogram_url: "",
        quality: null,
      },
    });

    expect(await screen.findByText(/analysis in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/status: processing/i)).toBeInTheDocument();
  });

  it("shows the empty state for unknown recordings", async () => {
    getResultsMock.mockRejectedValue(new Error("404"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/results/missing"]}>
          <Routes>
            <Route path="/results/:fileId" element={<Results />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText(/couldn't load this recording/i)).toBeInTheDocument();
  });
});
