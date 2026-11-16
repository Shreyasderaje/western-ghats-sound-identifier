"""YAMNet model loading and species-detection inference.

MVP approach (Option A from the plan): YAMNet is a *generic* audio
classifier — it cannot name Western Ghats species directly. We therefore:

1. Run YAMNet over the 16 kHz waveform; it scores 521 AudioSet classes for
   every 0.96 s patch (one row of scores every 0.48 s).
2. Collapse the bird/frog-related generic labels into a category score per
   frame (see species_reference.CATEGORY_YAMNET_CLASSES).
3. Merge adjacent frames of the same category into call events.
4. Estimate each event's dominant frequency and pick the Western Ghats
   species whose call band matches it best.

The class-name -> index mapping comes from data/yamnet_class_map.csv (the
official AudioSet/YAMNet label file, committed to the repo so inference
works offline once the model itself is cached).
"""
import csv
import logging
import math
import threading

import numpy as np

import audio_processor
from config import Config
from species_reference import (
    CATEGORY_YAMNET_CLASSES,
    IN_BAND_PRIOR,
    NEAREST_BAND_PRIOR,
    candidates_for_category,
)

logger = logging.getLogger(__name__)


class ModelUnavailableError(RuntimeError):
    """Raised when YAMNet (or TensorFlow) cannot be loaded."""


def load_class_map(csv_path=Config.YAMNET_CLASS_MAP_CSV) -> dict:
    """Read yamnet_class_map.csv into {class_name: output_index}."""
    mapping = {}
    with open(csv_path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            mapping[row["display_name"]] = int(row["index"])
    return mapping


class YamnetSpeciesClassifier:
    """Thread-safe lazy loader + inference wrapper around YAMNet."""

    def __init__(self):
        self._model = None
        self._class_map = None
        self._load_error = None
        self._lock = threading.Lock()

    # -- lifecycle ---------------------------------------------------------

    def _ensure_loaded(self):
        with self._lock:
            if self._model is not None or self._load_error is not None:
                return
            try:
                import tensorflow as tf  # noqa: F401  (warm-up, logged once)
                import tensorflow_hub as hub

                logger.info("Loading YAMNet from %s ...", Config.YAMNET_MODEL_URL)
                self._model = hub.load(Config.YAMNET_MODEL_URL)
                self._class_map = load_class_map()
                logger.info(
                    "YAMNet ready (%d classes)", len(self._class_map)
                )
            except Exception as exc:  # keep the API alive to report the problem
                self._load_error = f"Failed to load YAMNet: {exc}"
                logger.exception("YAMNet load failed")

    @property
    def status(self) -> dict:
        """For /api/health: whether the model is usable and why not, if not."""
        self._ensure_loaded()
        return {
            "loaded": self._model is not None,
            "error": self._load_error,
            "model_url": Config.YAMNET_MODEL_URL,
        }

    # -- inference ---------------------------------------------------------

    def detect(
        self, waveform: np.ndarray, sample_rate: int, threshold: float = None
    ) -> list:
        """Return call events: [{start_time, end_time, species_name, ...}].

        ``threshold`` overrides Config.YAMNET_SCORE_THRESHOLD for this run
        (used by the UI confidence slider).
        """
        self._ensure_loaded()
        if self._model is None:
            raise ModelUnavailableError(self._load_error or "YAMNet is not loaded")
        if sample_rate != 16000:
            raise ValueError("YAMNet expects 16 kHz audio; resample before calling detect()")

        scores, _, _ = self._model(waveform)
        scores = scores.numpy()  # shape: (num_patches, 521)

        frame_events = self._category_frame_events(
            scores, threshold if threshold is not None else Config.YAMNET_SCORE_THRESHOLD
        )
        groups = self._merge_frames(frame_events)

        detections = []
        for group in groups:
            detection = self._assign_species(group, waveform, sample_rate)
            if detection:
                detections.append(detection)
        detections.sort(key=lambda d: d["start_time"])
        return detections

    # -- steps 2 and 3 ------------------------------------------------------

    def _category_frame_events(self, scores: np.ndarray, threshold: float) -> list:
        """Score each patch frame per category; keep frames above threshold."""
        events = []
        for category, label_names in CATEGORY_YAMNET_CLASSES.items():
            label_indices = [
                (name, self._class_map[name])
                for name in label_names
                if name in self._class_map
            ]
            if not label_indices:
                logger.warning("No YAMNet classes resolved for category '%s'", category)
                continue

            for frame_idx in range(scores.shape[0]):
                row = scores[frame_idx]
                best_name, best_idx = max(
                    label_indices, key=lambda pair: row[pair[1]]
                )
                score = float(row[best_idx])
                if score >= threshold:
                    events.append(
                        {
                            "category": category,
                            "yamnet_label": best_name,
                            "raw_score": score,
                            "frame": frame_idx,
                            "start_time": frame_idx * Config.FRAME_HOP_SECONDS,
                            "end_time": frame_idx * Config.FRAME_HOP_SECONDS
                            + Config.PATCH_SECONDS,
                        }
                    )
        events.sort(key=lambda e: (e["frame"], e["category"]))
        return events

    @staticmethod
    def _merge_frames(events: list) -> list:
        """Merge consecutive same-category frames into call events.

        Bird and frog frames are merged on independent timelines so the two
        categories never fragment each other.
        """
        max_gap = Config.MERGE_GAP_SECONDS
        by_category = {}
        for event in events:  # already sorted by frame index
            by_category.setdefault(event["category"], []).append(event)

        groups = []
        for category_events in by_category.values():
            current = None
            for event in category_events:
                if current and event["start_time"] - current["end_time"] <= max_gap:
                    current["end_time"] = max(current["end_time"], event["end_time"])
                    if event["raw_score"] > current["raw_score"]:
                        current["raw_score"] = event["raw_score"]
                        current["yamnet_label"] = event["yamnet_label"]
                else:
                    current = dict(event)
                    groups.append(current)
        return groups

    # -- step 4: species assignment -----------------------------------------

    def _assign_species(self, group: dict, waveform: np.ndarray, sample_rate: int):
        """Choose the species for one merged event via dominant frequency."""
        category = group["category"]
        candidates = candidates_for_category(category)
        dominant_hz = audio_processor.dominant_frequency(
            waveform, sample_rate, group["start_time"], group["end_time"]
        )

        chosen, prior = None, NEAREST_BAND_PRIOR
        if dominant_hz is not None and candidates:
            in_band = [
                s for s in candidates
                if s["freq_low_hz"] <= dominant_hz <= s["freq_high_hz"]
            ]
            if in_band:
                # Prefer the narrowest band that contains the frequency.
                chosen = min(
                    in_band, key=lambda s: s["freq_high_hz"] - s["freq_low_hz"]
                )
                prior = IN_BAND_PRIOR
            else:
                nearest = min(
                    candidates,
                    key=lambda s: min(
                        abs(dominant_hz - s["freq_low_hz"]),
                        abs(dominant_hz - s["freq_high_hz"]),
                    ),
                )
                chosen = nearest

        if chosen is not None:
            species_name = chosen["scientific_name"]
        else:
            species_name = f"Unidentified {category}"

        # Cap so the mapped confidence never reads as "certain".
        confidence = min(group["raw_score"] * prior, 0.99)
        return {
            "species_name": species_name,
            "common_name": chosen["common_name"] if chosen else None,
            "scientific_name": chosen["scientific_name"] if chosen else None,
            "category": category,
            "start_time": round(group["start_time"], 2),
            "end_time": round(group["end_time"], 2),
            "confidence": round(confidence, 3),
            "yamnet_label": group["yamnet_label"],
            "raw_score": round(group["raw_score"], 3),
            "dominant_hz": round(dominant_hz, 1) if dominant_hz else None,
        }


# Single shared instance for the whole app.
classifier = YamnetSpeciesClassifier()


def frames_for_duration(duration_seconds: float) -> int:
    """Number of YAMNet score frames expected for a recording of this length."""
    return max(0, math.ceil(duration_seconds / Config.FRAME_HOP_SECONDS))
