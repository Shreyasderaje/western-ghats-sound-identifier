import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Bird, FileText, Mic, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: Bird,
    title: "30 Western Ghats species",
    text: "20 endemic and iconic birds plus 10 frogs, from the Malabar Grey Hornbill to the Purple Frog.",
  },
  {
    icon: Mic,
    title: "Recordings up to 500 MB",
    text: "Upload WAV, MP3 or M4A field recordings — or capture live from your microphone.",
  },
  {
    icon: BarChart3,
    title: "Timestamped detections",
    text: "Every call event with start/end times, confidence scores and an annotated spectrogram.",
  },
  {
    icon: FileText,
    title: "Biodiversity reports",
    text: "One-click PDF reports with diversity indices, plus raw CSV exports for research.",
  },
  {
    icon: ShieldCheck,
    title: "Quality-aware results",
    text: "Recordings are scored for noise and clipping; confidences adjust accordingly.",
  },
];

export default function Landing() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-teal-600 to-secondary-700 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10" />
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium uppercase tracking-wider">
          🌿 One of the world's biodiversity hotspots
        </p>
        <h1 className="mx-auto max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
          Hear the Western Ghats.
          <br />
          Know who's calling.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-white/85 sm:text-base">
          Upload a field recording and get bird and frog identifications with
          timestamps, confidence scores, spectrograms and biodiversity reports.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-primary-700 shadow hover:bg-primary-50"
          >
            Analyze a recording <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/species"
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3 font-semibold hover:bg-white/10"
          >
            Browse the species list
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section aria-label="Features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mb-1 font-semibold">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="card p-6 sm:p-8">
        <h2 className="mb-6 text-xl font-semibold">How it works</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {[
            ["Upload", "Drop in a recording from your phone or recorder — dawn choruses and monsoon nights work great."],
            ["AI analysis", "Google's YAMNet audio model spots animal sounds; a frequency heuristic maps them to Western Ghats species."],
            ["Explore & export", "Review the timeline and spectrogram, tune the confidence threshold, download PDF or CSV reports."],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
