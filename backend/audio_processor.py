"""Audio loading, validation and spectrogram generation.

Pipeline: any uploaded file is decoded to mono float32 at 16 kHz (YAMNet's
expected input), peak-normalised, then analysed. Mel-spectrogram PNGs are
rendered here and reused by both the results page and the PDF report.
"""
import colorsys
import logging

import numpy as np

import matplotlib

matplotlib.use("Agg")  # headless rendering; must be set before pyplot import

import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Rectangle  # noqa: E402

from config import Config

logger = logging.getLogger(__name__)


def load_audio(path, target_sr: int = Config.TARGET_SAMPLE_RATE) -> np.ndarray:
    """Decode an audio file to mono float32 at ``target_sr``, peak-normalised.

    WAV and MP3 decode with soundfile; M4A additionally needs ffmpeg on PATH
    (librosa falls back to audioread for it).
    """
    import librosa  # imported lazily: heavy dependencies, and tests may not need it

    waveform, _ = librosa.load(str(path), sr=target_sr, mono=True)
    if waveform.size == 0:
        raise ValueError("Audio file contains no samples")

    peak = float(np.max(np.abs(waveform)))
    if peak > 0:
        waveform = waveform / peak  # normalise to [-1.0, 1.0]
    return waveform.astype(np.float32)


def validate_audio(path) -> dict:
    """Best-effort metadata probe (duration, sample rate, channels).

    Returns {} fields as None when the format cannot be probed without
    decoding the whole file (e.g. M4A without ffmpeg installed).
    """
    try:
        import soundfile as sf

        info = sf.info(str(path))
        return {
            "duration": info.duration,
            "sample_rate": info.samplerate,
            "channels": info.channels,
        }
    except Exception:
        logger.debug("soundfile could not probe %s; trying librosa", path, exc_info=True)
    try:
        import librosa

        duration = librosa.get_duration(path=str(path))
        return {"duration": duration, "sample_rate": None, "channels": None}
    except Exception:
        logger.warning("Could not read audio metadata for %s", path)
        return {"duration": None, "sample_rate": None, "channels": None}


def dominant_frequency(
    waveform: np.ndarray,
    sample_rate: int,
    start_s: float,
    end_s: float,
    min_hz: int = Config.FREQ_SEARCH_MIN_HZ,
    max_hz: int = Config.FREQ_SEARCH_MAX_HZ,
):
    """Estimate the dominant frequency (FFT peak) of one audio slice.

    Used to pick a plausible species within a generic YAMNet detection.
    Returns None when the slice is effectively silent.
    """
    start = int(start_s * sample_rate)
    end = min(int(end_s * sample_rate), waveform.shape[0])
    if end - start < 64:
        return None

    segment = waveform[start:end].astype(np.float64)
    if float(np.sqrt(np.mean(segment ** 2))) < 1e-4:
        return None  # near-silence: no meaningful spectrum

    windowed = segment * np.hanning(segment.shape[0])
    spectrum = np.abs(np.fft.rfft(windowed))
    freqs = np.fft.rfftfreq(segment.shape[0], d=1.0 / sample_rate)

    band = (freqs >= min_hz) & (freqs <= max_hz)
    if not band.any():
        return None
    peak_index = int(np.argmax(spectrum[band]))
    return float(freqs[band][peak_index])


def _species_color(species_name: str):
    """Deterministic pastel color per species.

    Uses a stable checksum (not Python's randomized hash()) so colors match
    across runs — and across the frontend legend, which mirrors the formula.
    """
    digest = sum(ord(c) for c in species_name)
    hue = ((digest * 47) % 360) / 360.0
    r, g, b = colorsys.hsv_to_rgb(hue, 0.55, 0.95)
    return (r, g, b)


def generate_spectrogram(
    waveform: np.ndarray,
    sample_rate: int,
    detections: list,
    output_path,
) -> str:
    """Render a Mel-spectrogram PNG, optionally overlaid with detection boxes.

    ``detections`` is a list of dicts with at least start_time, end_time and
    species_name. Returns the path of the written image.
    """
    import librosa

    mel = librosa.feature.melspectrogram(
        y=waveform, sr=sample_rate, n_fft=2048, hop_length=512, n_mels=128
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)

    total_seconds = waveform.shape[0] / sample_rate
    frames_per_second = sample_rate / 512  # matches hop_length above

    fig, ax = plt.subplots(figsize=(12, 4.5), dpi=110)
    img = ax.imshow(
        mel_db,
        origin="lower",
        aspect="auto",
        extent=(0, total_seconds, 0, sample_rate / 2),
        cmap="magma",
    )
    fig.colorbar(img, ax=ax, format="%+0.0f dB", pad=0.01)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Frequency (Hz)")
    ax.set_ylim(0, min(sample_rate / 2, 11000))  # species calls live below ~11 kHz
    ax.set_title("Mel-spectrogram with detected calls")

    for index, det in enumerate(detections):
        color = _species_color(det["species_name"])
        ax.add_patch(
            Rectangle(
                (det["start_time"], 0),
                max(det["end_time"] - det["start_time"], 0.05),
                min(sample_rate / 2, 11000),
                facecolor=color,
                alpha=0.18,
                edgecolor=color,
                linewidth=1.2,
            )
        )
        ax.text(
            det["start_time"] + 0.04,
            min(sample_rate / 2, 11000) * 0.94,
            f"{det.get('category', '')}: {det['species_name']}",
            fontsize=6.5,
            color="white",
            bbox={"facecolor": color, "alpha": 0.75, "pad": 1.5},
            verticalalignment="top",
        )

    # Keep the x-ruler in whole seconds even for long recordings.
    if total_seconds > 600:
        ticks = np.arange(0, total_seconds, 60)
        ax.set_xticks(ticks)
        ax.set_xticklabels([f"{int(t // 60)}:{int(t % 60):02d}" for t in ticks])

    fig.tight_layout()
    fig.savefig(str(output_path), bbox_inches="tight")
    plt.close(fig)
    logger.info("Spectrogram written to %s", output_path)
    return str(output_path)


# ---------------------------------------------------------------------------
# Audio quality assessment (plan Step 4.3)
# ---------------------------------------------------------------------------

# Confidence multiplier applied to detections based on recording quality:
# poor recordings produce less reliable detections, excellent ones slightly
# more reliable. Adjusted confidences are capped at 0.99 by the pipeline.
QUALITY_CONFIDENCE_FACTOR = {
    "poor": 0.90,
    "fair": 1.00,
    "good": 1.00,
    "excellent": 1.05,
}


def assess_audio_quality(waveform: np.ndarray, sample_rate: int) -> dict:
    """Score recording quality (SNR, clipping, noise) and return guidance.

    Returns {score (0-100), label, snr_db, clipping_percent, recommendations}.
    """
    recommendations = []
    magnitude = np.abs(waveform)
    peak = float(magnitude.max()) if magnitude.size else 0.0

    # Clipping: share of samples pinned at (or a hair below) full scale.
    clipping = float(np.mean(magnitude >= 0.99)) * 100.0 if peak > 0 else 0.0

    # SNR estimate from frame energy: loud frames vs the noise floor.
    frame = max(int(0.02 * sample_rate), 64)
    n_frames = waveform.size // frame
    if n_frames >= 4:
        rms = np.sqrt(
            np.mean(waveform[: n_frames * frame].reshape(n_frames, frame) ** 2, axis=1)
        )
        noise = float(np.percentile(rms, 10))
        signal = float(np.percentile(rms, 75))
        snr_db = 20.0 * np.log10(signal / noise) if noise > 1e-8 else 60.0
    else:
        snr_db = 30.0  # too short to profile; assume neutral

    score = 100.0
    if clipping > 1.0:
        score -= 40.0
        recommendations.append("Recording is distorted (clipping) — reduce input gain.")
    elif clipping > 0.1:
        score -= 15.0
        recommendations.append("Some samples are clipped — lower the recording level slightly.")
    if snr_db < 10:
        score -= 30.0
        recommendations.append("Very noisy — get closer to the calling animal.")
    elif snr_db < 20:
        score -= 12.0
        recommendations.append("Moderate background noise — expect fewer detections.")
    if peak < 0.05:
        score -= 25.0
        recommendations.append("Signal is very quiet — increase recording volume.")
    if not recommendations:
        recommendations.append("Recording quality looks good — results should be reliable.")

    score = max(0.0, min(100.0, score))
    if score >= 80:
        label = "excellent"
    elif score >= 60:
        label = "good"
    elif score >= 40:
        label = "fair"
    else:
        label = "poor"

    return {
        "score": round(score, 1),
        "label": label,
        "snr_db": round(snr_db, 1),
        "clipping_percent": round(clipping, 3),
        "recommendations": recommendations,
    }
