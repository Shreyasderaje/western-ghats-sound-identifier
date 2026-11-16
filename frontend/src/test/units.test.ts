import { describe, expect, it } from "vitest";
import { validateFile, formatBytes } from "../hooks/useApi";
import { speciesColor, confidenceTier } from "../types";
import { computeSummaryClient } from "./summary";

describe("validateFile", () => {
  it("accepts wav, mp3 and m4a", () => {
    for (const name of ["dawn.wav", "night.MP3", "stream.m4a"]) {
      const file = new File(["x"], name, { type: "audio/x" });
      expect(validateFile(file)).toBeNull();
    }
  });

  it("rejects other formats", () => {
    const file = new File(["x"], "notes.txt");
    expect(validateFile(file)).toMatch(/Unsupported format/);
  });

  it("rejects files over 500 MB", () => {
    const file = new File(["x"], "huge.wav");
    Object.defineProperty(file, "size", { value: 501 * 1024 * 1024 });
    expect(validateFile(file)).toMatch(/limit is 500 MB/);
  });
});

describe("formatBytes", () => {
  it("formats B, KB and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("speciesColor", () => {
  it("is deterministic and produces rgb() strings", () => {
    const a = speciesColor("Harpactes fasciatus");
    const b = speciesColor("Harpactes fasciatus");
    expect(a).toBe(b);
    expect(a).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });

  it("varies between species", () => {
    expect(speciesColor("Aaaa")).not.toBe(speciesColor("Bbbb"));
  });
});

describe("confidenceTier", () => {
  it("buckets confidence into low/medium/high", () => {
    expect(confidenceTier(0.2)).toBe("low");
    expect(confidenceTier(0.5)).toBe("medium");
    expect(confidenceTier(0.75)).toBe("high");
  });
});

describe("computeSummaryClient", () => {
  const detections = [
    { species_name: "A", category: "bird" as const, start_time: 0, end_time: 1, confidence: 0.8 },
    { species_name: "A", category: "bird" as const, start_time: 2, end_time: 3, confidence: 0.6 },
    { species_name: "B", category: "frog" as const, start_time: 4, end_time: 5, confidence: 0.3 },
  ];

  it("computes per-species counts and averages", () => {
    const summary = computeSummaryClient(detections);
    expect(summary.total).toBe(3);
    expect(summary.perSpecies["A"].count).toBe(2);
    expect(summary.perSpecies["A"].avg).toBeCloseTo(0.7);
    expect(summary.perSpecies["B"].count).toBe(1);
  });

  it("handles empty input", () => {
    const summary = computeSummaryClient([]);
    expect(summary.total).toBe(0);
    expect(Object.keys(summary.perSpecies)).toHaveLength(0);
  });
});
