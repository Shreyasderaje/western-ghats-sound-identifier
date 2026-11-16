import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "unsupported";

/**
 * Live microphone capture (plan Phase 6 enhancement 2).
 * Guards for browsers/tests without MediaRecorder; the recorded blob is
 * handed to the caller as a File ready for the normal upload flow.
 */
export function useRecorder(onStop: (blob: Blob) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0); // 0-1 rough loudness meter
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
      setStatus("unsupported");
    }
    return () => stopEverything(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopEverything = (emit: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      if (!emit) recorder.onstop = null;
      recorder.stop();
    }
    setLevel(0);
  };

  const start = useCallback(async () => {
    if (status === "unsupported") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Loudness meter via AnalyserNode.
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const v of buffer) sum += (v - 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buffer.length) / 40));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        onStop(blob);
        stream.getTracks().forEach((t) => t.stop());
        context.close();
        setStatus("idle");
        setSeconds(0);
      };
      recorder.start(500);
      recorderRef.current = recorder;
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error("Microphone access failed:", err);
      setStatus("idle");
      throw err;
    }
  }, [onStop, status]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop(); // onstop fires the callback
    }
  }, []);

  return { status, seconds, level, start, stop };
}
