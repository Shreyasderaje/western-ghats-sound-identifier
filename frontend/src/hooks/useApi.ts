/** Upload + processing + results hooks built on React Query. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteRecording,
  generateCsvReport,
  generatePdfReport,
  getAnalyticsSummary,
  getHistory,
  getProcessingStatus,
  getResults,
  getTopSpecies,
  getTrends,
  startProcessing,
  toggleShare,
  uploadAudio,
} from "../services/api";
import type { Job } from "../types";

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB, matches backend
export const ALLOWED_EXTENSIONS = [".wav", ".mp3", ".m4a"];

export function validateFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const ok = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!ok) return `Unsupported format. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is ${(file.size / 1024 / 1024).toFixed(0)} MB; the limit is 500 MB.`;
  }
  return null;
}

/** Human-readable file size, e.g. "3.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface UploadState {
  file: File | null;
  error: string | null;
  progress: number;
  uploading: boolean;
}

export function useAudioUpload() {
  const [state, setState] = useState<UploadState>({
    file: null,
    error: null,
    progress: 0,
    uploading: false,
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (vars: {
      file: File;
      location?: string;
      latitude?: number | null;
      longitude?: number | null;
    }) =>
      uploadAudio(vars.file, {
        location: vars.location,
        latitude: vars.latitude,
        longitude: vars.longitude,
        onProgress: (percent) => setState((s) => ({ ...s, progress: percent })),
      }),
    onMutate: () => setState((s) => ({ ...s, uploading: true, progress: 0, error: null })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (err: Error) => {
      setState((s) => ({ ...s, error: err.message || "Upload failed." }));
      toast.error("Upload failed", { description: err.message });
    },
    onSettled: () => setState((s) => ({ ...s, uploading: false })),
  });

  const selectFile = useCallback((file: File | null) => {
    if (!file) {
      setState({ file: null, error: null, progress: 0, uploading: false });
      return;
    }
    const error = validateFile(file);
    if (error) {
      setState({ file: null, error, progress: 0, uploading: false });
      toast.warning("Cannot use this file", { description: error });
      return;
    }
    setState({ file, error: null, progress: 0, uploading: false });
  }, []);

  const upload = useCallback(
    (location?: string, latitude?: number | null, longitude?: number | null) => {
      if (state.file) mutation.mutate({ file: state.file, location, latitude, longitude });
    },
    [mutation, state.file]
  );

  return { ...state, recordedUrl: null, selectFile, upload, uploadResult: mutation.data ?? null };
}

/** Polls /api/process/{id}/status until the job settles. */
export function useProcessing(fileId: string | null) {
  const query = useQuery({
    queryKey: ["processing", fileId],
    queryFn: () => getProcessingStatus(fileId!),
    enabled: Boolean(fileId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "in_queue" || status === "processing" ? 2000 : false;
    },
  });

  const start = useMutation({
    mutationFn: (threshold?: number) => startProcessing(fileId!, threshold),
    onError: (err: Error) => toast.error("Could not start processing", { description: err.message }),
  });

  return { job: (query.data as Job | undefined) ?? null, start, refetch: query.refetch };
}

export function useResults(fileId: string | null) {
  return useQuery({
    queryKey: ["results", fileId],
    queryFn: () => getResults(fileId!),
    enabled: Boolean(fileId),
  });
}

export function useReports(fileId: string) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  const pdf = useCallback(async () => {
    try {
      setBusy("pdf");
      await generatePdfReport(fileId);
      toast.success("PDF report downloaded");
    } catch (err) {
      toast.error("PDF generation failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }, [fileId]);

  const csv = useCallback(async () => {
    try {
      setBusy("csv");
      await generateCsvReport(fileId);
      toast.success("CSV export downloaded");
    } catch (err) {
      toast.error("CSV generation failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }, [fileId]);

  return { pdf, csv, busy };
}

export function useHistory(page: number, perPage = 10) {
  return useQuery({
    queryKey: ["history", page, perPage],
    queryFn: () => getHistory(page, perPage),
    placeholderData: (prev) => prev,
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => deleteRecording(fileId),
    onSuccess: (_data, fileId) => {
      toast.success("Recording deleted");
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["results", fileId] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (err: Error) => toast.error("Delete failed", { description: err.message }),
  });
}

export function useShareToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { fileId: string; isPublic: boolean }) =>
      toggleShare(vars.fileId, vars.isPublic),
    onSuccess: ({ is_public }) => {
      toast.success(is_public ? "Recording shared publicly" : "Recording is private now");
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
    },
  });
}

export function useAnalytics() {
  const summary = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: getAnalyticsSummary,
  });
  const topSpecies = useQuery({
    queryKey: ["analytics", "top-species"],
    queryFn: () => getTopSpecies(10),
  });
  const trends = useQuery({
    queryKey: ["analytics", "trends"],
    queryFn: getTrends,
  });
  return { summary, topSpecies, trends };
}

/** Web-audio duration probe so the upload card can show length before upload. */
export function useAudioDuration(file: File | null): number | null {
  const [duration, setDuration] = useState<number | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    setDuration(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.src = url;
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [file]);

  return duration;
}
