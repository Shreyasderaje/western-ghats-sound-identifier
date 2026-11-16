import { useCallback, useEffect, useRef, useState } from "react";
import { FileAudio, MapPin, Mic, Square, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import {
  ALLOWED_EXTENSIONS,
  formatBytes,
  useAudioDuration,
  useAudioUpload,
} from "../hooks/useApi";
import { useRecorder } from "../hooks/useRecorder";
import type { Recording } from "../types";

interface Props {
  onUploaded: (fileId: string) => void;
}

export default function UploadZone({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [location, setLocation] = useState("");
  const { file, error, progress, uploading, selectFile, upload, uploadResult } =
    useAudioUpload();
  const duration = useAudioDuration(file);

  // Live capture hands its blob straight into the upload flow.
  const handleRecorded = useCallback(
    (blob: Blob) => {
      selectFile(
        new File([blob], `field_recording_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`, {
          type: blob.type,
        })
      );
      toast.success("Recording captured", { description: "Ready to analyze." });
    },
    [selectFile]
  );
  const recorder = useRecorder(handleRecorded);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) selectFile(dropped);
    },
    [selectFile]
  );

  const handleUpload = () => {
    if (file) upload(location.trim() || undefined);
  };

  // Navigate to the results page once the server accepts the upload.
  const uploadedId = (uploadResult as Recording | null)?.file_id ?? null;
  const navigatedRef = useRef<string | null>(null);
  useEffect(() => {
    if (uploadedId && navigatedRef.current !== uploadedId) {
      navigatedRef.current = uploadedId;
      toast.success("Upload complete", { description: "Starting analysis…" });
      onUploaded(uploadedId);
    }
  }, [uploadedId, onUploaded]);

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio recording"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
            : "border-slate-300 bg-white hover:border-primary-400 dark:border-slate-700 dark:bg-slate-900"
        }`}
      >
        <UploadCloud className="h-10 w-10 text-primary-500" />
        <div>
          <p className="font-medium">Drag &amp; drop an audio recording</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            or click to browse — WAV, MP3, M4A up to 500 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) selectFile(chosen);
            e.target.value = "";
          }}
        />
      </div>

      {/* Live recorder */}
      {recorder.status !== "unsupported" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={recorder.status === "recording" ? recorder.stop : () => recorder.start().catch((err) => toast.error("Microphone unavailable", { description: String(err) }))}
              aria-label={recorder.status === "recording" ? "Stop recording" : "Start recording"}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition ${
                recorder.status === "recording"
                  ? "animate-pulse bg-red-500 hover:bg-red-600"
                  : "bg-primary-600 hover:bg-primary-700"
              }`}
            >
              {recorder.status === "recording" ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
            <div className="text-sm">
              {recorder.status === "recording" ? (
                <>
                  <p className="font-medium text-red-500">
                    Recording · {Math.floor(recorder.seconds / 60)}:
                    {String(recorder.seconds % 60).padStart(2, "0")}
                  </p>
                  <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${Math.round(recorder.level * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  No file handy? Record from your microphone.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {file && (
        <div className="card flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileAudio className="h-8 w-8 text-primary-500" />
              <div>
                <p className="font-medium" data-testid="selected-file-name">
                  {file.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatBytes(file.size)}
                  {duration != null &&
                    ` · ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`}
                </p>
              </div>
            </div>
            <button
              aria-label="Remove selected file"
              onClick={() => selectFile(null)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional), e.g. Agumbe"
              className="w-full bg-transparent outline-none"
            />
          </label>

          {uploading && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload & analyze"}
          </button>
        </div>
      )}
    </div>
  );
}
