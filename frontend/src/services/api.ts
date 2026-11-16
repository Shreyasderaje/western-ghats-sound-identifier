/** Axios API client for the Flask backend, with mock-mode support. */
import axios, { AxiosProgressEvent } from "axios";
import {
  MOCK_ANALYTICS,
  MOCK_LEADERBOARD,
  MOCK_RECORDINGS,
  MOCK_RESULTS,
  MOCK_SPECTROGRAM_SVG,
  MOCK_SPECIES,
  MOCK_TOP_SPECIES,
  MOCK_TRENDS,
  mockRecordingsPage,
} from "./mockData";
import type {
  AnalyticsSummary,
  Detection,
  Job,
  LeaderboardEntry,
  Paged,
  Recording,
  RecordingSummary,
  ResultsResponse,
  SpeciesRef,
  TopSpecies,
  TrendPoint,
  User,
} from "../types";

const TOKEN_KEY = "wgsi_token";

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === "true";

export const http = axios.create({ baseURL: API_BASE_URL });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// Auth token plumbing (also used by the AuthContext)
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Small mock-mode helper: simulate network latency for canned data.
// ---------------------------------------------------------------------------

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<{ status: string; model: { loaded: boolean; error: string | null } }> {
  if (USE_MOCKS) return { status: "ok", model: { loaded: true, error: null } };
  const { data } = await http.get("/api/health");
  return data;
}

export async function getSpecies(): Promise<SpeciesRef[]> {
  if (USE_MOCKS) {
    await delay();
    return MOCK_SPECIES;
  }
  const { data } = await http.get("/api/species");
  return data.species;
}

export async function register(username: string, password: string): Promise<{ token: string; user: User }> {
  if (USE_MOCKS) {
    await delay();
    return { token: "mock-token", user: { id: 1, username } };
  }
  const { data } = await http.post("/api/auth/register", { username, password });
  return data;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  if (USE_MOCKS) {
    await delay();
    return { token: "mock-token", user: { id: 1, username } };
  }
  const { data } = await http.post("/api/auth/login", { username, password });
  return data;
}

export async function getCurrentUser(): Promise<User | null> {
  if (USE_MOCKS || !getToken()) return null;
  try {
    const { data } = await http.get("/api/auth/me");
    return data.user;
  } catch {
    return null;
  }
}

export interface UploadOptions {
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  onProgress?: (percent: number) => void;
}

export async function uploadAudio(file: File, options: UploadOptions = {}): Promise<Recording> {
  if (USE_MOCKS) {
    await delay(800);
    options.onProgress?.(100);
    return {
      file_id: `mock${Date.now()}`,
      filename: file.name,
      upload_date: new Date().toISOString(),
      duration: 30,
      location: options.location ?? null,
      latitude: options.latitude ?? null,
      longitude: options.longitude ?? null,
      sample_rate: 16000,
      quality_score: null,
      quality_label: null,
      is_public: false,
      username: null,
    };
  }

  const form = new FormData();
  form.append("file", file);
  if (options.location) form.append("location", options.location);
  if (options.latitude != null) form.append("latitude", String(options.latitude));
  if (options.longitude != null) form.append("longitude", String(options.longitude));

  const { data } = await http.post("/api/audio/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (e.total) options.onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

export async function startProcessing(fileId: string, confidenceThreshold?: number): Promise<Job> {
  if (USE_MOCKS) {
    await delay();
    return { job_id: 1, file_id: fileId, status: "in_queue" };
  }
  const body = confidenceThreshold != null ? { confidence_threshold: confidenceThreshold } : {};
  const { data } = await http.post(`/api/process/${fileId}`, body);
  return data;
}

export async function getProcessingStatus(fileId: string): Promise<Job & { results?: ResultsResponse["results"] }> {
  if (USE_MOCKS) {
    await delay(1200);
    return {
      job_id: 1,
      file_id: fileId,
      status: "completed",
      processing_time: 2.4,
      results: MOCK_RESULTS.results,
    };
  }
  const { data } = await http.get(`/api/process/${fileId}/status`);
  return data;
}

export async function getResults(fileId: string): Promise<ResultsResponse> {
  if (USE_MOCKS) {
    await delay();
    return { ...MOCK_RESULTS, results: { ...MOCK_RESULTS.results!, recording: MOCK_RECORDINGS.find((r) => r.file_id === fileId) ?? MOCK_RESULTS.results!.recording } };
  }
  const { data } = await http.get(`/api/results/${fileId}`);
  return data;
}

export function getSpectrogramUrl(fileId: string): string {
  if (USE_MOCKS) return MOCK_SPECTROGRAM_SVG;
  return `${API_BASE_URL}/api/spectrogram/${fileId}`;
}

async function downloadFile(url: string, filename: string) {
  const response = await http.post(url, undefined, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function generatePdfReport(fileId: string): Promise<void> {
  if (USE_MOCKS) return delay(600);
  return downloadFile(`/api/reports/${fileId}/pdf`, `biodiversity_report_${fileId}.pdf`);
}

export function generateCsvReport(fileId: string): Promise<void> {
  if (USE_MOCKS) return delay(400);
  return downloadFile(`/api/reports/${fileId}/csv`, `detections_${fileId}.csv`);
}

export async function getHistory(page = 1, perPage = 10): Promise<Paged<RecordingSummary>> {
  if (USE_MOCKS) {
    await delay();
    return mockRecordingsPage(page, perPage);
  }
  const { data } = await http.get("/api/recordings", { params: { page, per_page: perPage } });
  return data;
}

export async function deleteRecording(fileId: string): Promise<void> {
  if (USE_MOCKS) return delay(200);
  await http.delete(`/api/recordings/${fileId}`);
}

export async function toggleShare(fileId: string, isPublic: boolean): Promise<{ is_public: boolean }> {
  if (USE_MOCKS) return delay(200).then(() => ({ is_public: isPublic }));
  const { data } = await http.post(`/api/recordings/${fileId}/share`, { is_public: isPublic });
  return data;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  if (USE_MOCKS) return delay().then(() => MOCK_ANALYTICS);
  const { data } = await http.get("/api/analytics/summary");
  return data;
}

export async function getTopSpecies(limit = 10): Promise<TopSpecies[]> {
  if (USE_MOCKS) return delay().then(() => MOCK_TOP_SPECIES);
  const { data } = await http.get("/api/analytics/top-species", { params: { limit } });
  return data.species;
}

export async function getTrends(): Promise<TrendPoint[]> {
  if (USE_MOCKS) return delay().then(() => MOCK_TRENDS);
  const { data } = await http.get("/api/analytics/trends");
  return data.trends;
}

export async function getPublicRecordings(page = 1, perPage = 12): Promise<Paged<RecordingSummary>> {
  if (USE_MOCKS) return delay().then(() => mockRecordingsPage(page, perPage));
  const { data } = await http.get("/api/public/recordings", { params: { page, per_page: perPage } });
  return { ...data, total_pages: data.total_pages ?? 0 };
}

export async function getPublicResults(fileId: string): Promise<ResultsResponse> {
  if (USE_MOCKS) return delay().then(() => MOCK_RESULTS);
  const { data } = await http.get(`/api/public/recordings/${fileId}`);
  return data;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  if (USE_MOCKS) return delay().then(() => MOCK_LEADERBOARD);
  const { data } = await http.get("/api/community/leaderboard");
  return data.leaderboard;
}

/** Re-filter stored detections client-side when the confidence slider moves. */
export function filterDetections(detections: Detection[], threshold: number): Detection[] {
  return detections.filter((d) => d.confidence >= threshold);
}
