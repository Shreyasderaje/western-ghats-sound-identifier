/** Canned demo data so the UI can be developed/demoed without a backend. */
import type {
  AnalyticsSummary,
  Detection,
  LeaderboardEntry,
  Paged,
  RecordingSummary,
  ResultsResponse,
  SpeciesRef,
  TopSpecies,
  TrendPoint,
} from "../types";

export const MOCK_SPECIES: SpeciesRef[] = [
  { species_name: "Ocyceros griseus", common_name: "Malabar Grey Hornbill", scientific_name: "Ocyceros griseus", category: "bird", habitat: "Evergreen and moist deciduous forests" },
  { species_name: "Myophonus horsfieldii", common_name: "Malabar Whistling Thrush", scientific_name: "Myophonus horsfieldii", category: "bird", habitat: "Hill streams and rocky rivers" },
  { species_name: "Harpactes fasciatus", common_name: "Malabar Trogon", scientific_name: "Harpactes fasciatus", category: "bird", habitat: "Dense evergreen forests" },
  { species_name: "Ficedula nigrorufa", common_name: "Black-and-orange Flycatcher", scientific_name: "Ficedula nigrorufa", category: "bird", habitat: "Shola forests" },
  { species_name: "Rhacophorus malabaricus", common_name: "Malabar Gliding Frog", scientific_name: "Rhacophorus malabaricus", category: "frog", habitat: "Forest canopy near streams" },
  { species_name: "Nyctibatrachus humayuni", common_name: "Bombay Night Frog", scientific_name: "Nyctibatrachus humayuni", category: "frog", habitat: "Streams and boulders" },
];

const MOCK_DETECTIONS: Detection[] = [
  { id: 1, species_name: "Ocyceros griseus", category: "bird", start_time: 0.5, end_time: 2.9, confidence: 0.82, yamnet_label: "Bird vocalization, bird call, bird song" },
  { id: 2, species_name: "Myophonus horsfieldii", category: "bird", start_time: 4.0, end_time: 6.1, confidence: 0.64, yamnet_label: "Bird" },
  { id: 3, species_name: "Harpactes fasciatus", category: "bird", start_time: 7.2, end_time: 8.8, confidence: 0.47, yamnet_label: "Chirp, tweet" },
  { id: 4, species_name: "Nyctibatrachus humayuni", category: "frog", start_time: 10.1, end_time: 12.4, confidence: 0.58, yamnet_label: "Croak" },
  { id: 5, species_name: "Ocyceros griseus", category: "bird", start_time: 14.0, end_time: 16.2, confidence: 0.71, yamnet_label: "Squawk" },
  { id: 6, species_name: "Rhacophorus malabaricus", category: "frog", start_time: 18.3, end_time: 19.9, confidence: 0.33, yamnet_label: "Frog" },
  { id: 7, species_name: "Ficedula nigrorufa", category: "bird", start_time: 22.0, end_time: 23.5, confidence: 0.44, yamnet_label: "Chirp, tweet" },
  { id: 8, species_name: "Myophonus horsfieldii", category: "bird", start_time: 26.1, end_time: 28.7, confidence: 0.66, yamnet_label: "Bird" },
];

export const MOCK_RECORDINGS: RecordingSummary[] = [
  { file_id: "demo0001", filename: "agumbe_dawn.wav", upload_date: "2026-10-17T06:12:00", duration: 30, location: "Agumbe, Karnataka", latitude: 13.91, longitude: 75.09, sample_rate: 16000, quality_score: 82, quality_label: "excellent", is_public: true, username: "demo_user", species_count: 5, detection_count: 8, status: "completed" },
  { file_id: "demo0002", filename: "silent_valley_night.m4a", upload_date: "2026-10-15T21:40:00", duration: 45.2, location: "Silent Valley, Kerala", latitude: 11.13, longitude: 76.43, sample_rate: 16000, quality_score: 61, quality_label: "good", is_public: false, username: "demo_user", species_count: 2, detection_count: 4, status: "completed" },
  { file_id: "demo0003", filename: "wayanad_stream.mp3", upload_date: "2026-10-12T08:05:00", duration: 60, location: "Wayanad, Kerala", latitude: 11.69, longitude: 76.13, sample_rate: 16000, quality_score: 44, quality_label: "fair", is_public: false, username: "demo_user", species_count: 3, detection_count: 6, status: "completed" },
  { file_id: "demo0004", filename: "amboli_monsoon.wav", upload_date: "2026-10-08T19:30:00", duration: 120, location: "Amboli, Maharashtra", latitude: 15.96, longitude: 73.99, sample_rate: 16000, quality_score: 35, quality_label: "poor", is_public: false, username: "demo_user", species_count: 1, detection_count: 2, status: "completed" },
  { file_id: "demo0005", filename: "nilgiris_shola.wav", upload_date: "2026-10-03T07:00:00", duration: 90.4, location: "Nilgiris, Tamil Nadu", latitude: 11.41, longitude: 76.7, sample_rate: 16000, quality_score: 77, quality_label: "good", is_public: false, username: "demo_user", species_count: 4, detection_count: 7, status: "completed" },
];

export const MOCK_RESULTS: ResultsResponse = {
  status: "completed",
  results: {
    recording: MOCK_RECORDINGS[0],
    summary: {
      total_detections: 8,
      unique_species: 5,
      birds: 3,
      frogs: 2,
      shannon_diversity: 1.502,
      recording_duration: 30,
      per_species: [
        { species_name: "Ocyceros griseus", common_name: "Malabar Grey Hornbill", category: "bird", count: 2, avg_confidence: 0.77 },
        { species_name: "Myophonus horsfieldii", common_name: "Malabar Whistling Thrush", category: "bird", count: 2, avg_confidence: 0.65 },
        { species_name: "Nyctibatrachus humayuni", common_name: "Bombay Night Frog", category: "frog", count: 1, avg_confidence: 0.58 },
        { species_name: "Harpactes fasciatus", common_name: "Malabar Trogon", category: "bird", count: 1, avg_confidence: 0.47 },
        { species_name: "Rhacophorus malabaricus", common_name: "Malabar Gliding Frog", category: "frog", count: 1, avg_confidence: 0.33 },
        { species_name: "Ficedula nigrorufa", common_name: "Black-and-orange Flycatcher", category: "bird", count: 1, avg_confidence: 0.44 },
      ],
    },
    detections: MOCK_DETECTIONS,
    spectrogram_url: "",
    quality: { score: 82, label: "excellent" },
  },
};

export const MOCK_ANALYTICS: AnalyticsSummary = {
  total_recordings: 5,
  total_detections: 27,
  unique_species: 9,
  avg_species_per_recording: 1.8,
  recordings_this_week: 2,
};

export const MOCK_TOP_SPECIES: TopSpecies[] = [
  { species_name: "Ocyceros griseus", count: 11 },
  { species_name: "Myophonus horsfieldii", count: 8 },
  { species_name: "Nyctibatrachus humayuni", count: 5 },
  { species_name: "Rhacophorus malabaricus", count: 4 },
  { species_name: "Ficedula nigrorufa", count: 3 },
  { species_name: "Harpactes fasciatus", count: 3 },
  { species_name: "Montecincla cachinnans", count: 2 },
  { species_name: "Psilopogon malabaricus", count: 2 },
];

export const MOCK_TRENDS: TrendPoint[] = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(2026, 9, 4 + i); // Oct 4 .. Oct 17
  return {
    date: date.toISOString().slice(0, 10),
    detections: [3, 6, 2, 8, 5, 0, 4, 7, 6, 9, 3, 5, 8, 6][i],
    species: [2, 3, 1, 4, 3, 0, 2, 4, 3, 4, 2, 3, 4, 3][i],
  };
});

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { username: "ghats_watcher", recordings: 23 },
  { username: "frogfanatic", recordings: 17 },
  { username: "demo_user", recordings: 5 },
  { username: "monsoon_mics", recordings: 4 },
];

export function mockRecordingsPage(page: number, perPage: number): Paged<RecordingSummary> {
  const start = (page - 1) * perPage;
  const items = MOCK_RECORDINGS.slice(start, start + perPage);
  return {
    recordings: items,
    page,
    total_pages: Math.ceil(MOCK_RECORDINGS.length / perPage),
    total: MOCK_RECORDINGS.length,
  };
}

/** Minimal inline SVG spectrogram so the mock viewer shows something real. */
export const MOCK_SPECTROGRAM_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="360" viewBox="0 0 960 360">
  <defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#120b2e"/><stop offset="0.5" stop-color="#b12a5b"/>
    <stop offset="0.8" stop-color="#fe9838"/><stop offset="1" stop-color="#fff7d8"/>
  </linearGradient></defs>
  <rect width="960" height="360" fill="url(#g)"/>
  ${Array.from({ length: 40 }, (_, i) => {
    const x = 20 + i * 23;
    const h = 20 + ((i * 37) % 140);
    return `<ellipse cx="${x}" cy="${200 - (i % 7) * 18}" rx="9" ry="${h / 2}" fill="rgba(255,255,255,0.18)"/>`;
  }).join("")}
  <text x="16" y="30" fill="#fff" font-family="sans-serif" font-size="16">Demo spectrogram (mock mode)</text>
</svg>`)}`;
