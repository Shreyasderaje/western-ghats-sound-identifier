/** Shared TypeScript interfaces mirroring the Flask API responses. */

export type Category = "bird" | "frog";
export type JobStatus = "not_started" | "in_queue" | "processing" | "completed" | "failed";
export type QualityLabel = "poor" | "fair" | "good" | "excellent";

export interface User {
  id: number;
  username: string;
}

export interface Recording {
  file_id: string;
  filename: string;
  upload_date: string | null;
  duration: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  sample_rate: number | null;
  quality_score: number | null;
  quality_label: QualityLabel | null;
  is_public: boolean;
  username: string | null;
}

export interface RecordingSummary extends Recording {
  species_count: number;
  detection_count: number;
  status: JobStatus;
}

export interface Detection {
  id?: number;
  species_name: string;
  common_name?: string | null;
  category: Category;
  start_time: number;
  end_time: number;
  confidence: number;
  yamnet_label: string;
}

export interface SpeciesSummary {
  species_name: string;
  common_name: string | null;
  category: Category | null;
  count: number;
  avg_confidence: number;
  max_confidence?: number;
  first_seen?: number;
  last_seen?: number;
}

export interface ResultsSummary {
  total_detections: number;
  unique_species: number;
  birds: number;
  frogs: number;
  shannon_diversity: number;
  recording_duration: number | null;
  per_species: SpeciesSummary[];
}

export interface Quality {
  score: number;
  label: QualityLabel;
}

export interface ResultsPayload {
  recording: Recording;
  summary: ResultsSummary;
  detections: Detection[];
  spectrogram_url: string;
  quality: Quality | null;
}

export interface Job {
  job_id: number;
  file_id: string;
  status: JobStatus;
  confidence_threshold?: number | null;
  processing_time?: number | null;
  error_message?: string | null;
}

export interface ResultsResponse {
  status: JobStatus;
  results: ResultsPayload | null;
}

export interface Paged<T> {
  recordings: T[];
  page: number;
  total_pages: number;
  total: number;
}

export interface AnalyticsSummary {
  total_recordings: number;
  total_detections: number;
  unique_species: number;
  avg_species_per_recording: number;
  recordings_this_week: number;
}

export interface TopSpecies {
  species_name: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  detections: number;
  species: number;
}

export interface LeaderboardEntry {
  username: string;
  recordings: number;
}

export interface SpeciesRef {
  species_name: string;
  common_name: string;
  scientific_name: string;
  category: Category;
  habitat: string;
}

/** Deterministic per-species color — mirrors backend audio_processor._species_color. */
export function speciesColor(name: string): string {
  let digest = 0;
  for (let i = 0; i < name.length; i++) digest += name.charCodeAt(i);
  const hue = ((digest * 47) % 360) / 360;
  const [r, g, b] = hsvToRgb(hue, 0.55, 0.95);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const table: [number, number, number][] = [
    [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q],
  ];
  return table[i % 6];
}
