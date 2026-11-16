import type { Detection } from "../types";

/** Client-side mirror of the backend summary used by threshold previewing. */
export function computeSummaryClient(detections: Detection[]) {
  const perSpecies: Record<
    string,
    { count: number; sumConfidence: number; avg: number }
  > = {};
  for (const d of detections) {
    const entry = perSpecies[d.species_name] ?? { count: 0, sumConfidence: 0, avg: 0 };
    entry.count += 1;
    entry.sumConfidence += d.confidence;
    entry.avg = entry.sumConfidence / entry.count;
    perSpecies[d.species_name] = entry;
  }
  return { total: detections.length, perSpecies };
}
