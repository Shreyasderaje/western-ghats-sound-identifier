"""Unit tests for the YAMNet -> species mapping logic (no model download)."""
import numpy as np

from ml_inference import YamnetSpeciesClassifier, load_class_map
from species_reference import candidates_for_category

CLASS_MAP = load_class_map()
BIRD_IDX = CLASS_MAP["Bird"]
FROG_IDX = CLASS_MAP["Frog"]


def make_classifier():
    classifier = YamnetSpeciesClassifier()
    classifier._class_map = CLASS_MAP  # unit test: skip the lazy model load
    return classifier


def test_class_map_has_expected_labels():
    for label in ("Bird", "Bird vocalization, bird call, bird song", "Chirp, tweet",
                  "Frog", "Croak", "Owl", "Hoot"):
        assert label in CLASS_MAP


def test_merge_frames_separates_categories():
    classifier = make_classifier()
    events = [
        # Bird frames 0-2, a frog frame in between, bird continues at 4:
        # must merge into one bird group (0.0-2.4) + one frog group (1.44-2.4),
        # because categories merge on independent timelines.
        {"category": "bird", "yamnet_label": "Bird", "raw_score": 0.5, "frame": 0,
         "start_time": 0.0, "end_time": 0.96},
        {"category": "frog", "yamnet_label": "Frog", "raw_score": 0.6, "frame": 3,
         "start_time": 1.44, "end_time": 2.40},
        {"category": "bird", "yamnet_label": "Bird", "raw_score": 0.7, "frame": 4,
         "start_time": 1.92, "end_time": 2.88},
    ]
    groups = classifier._merge_frames(events)
    birds = [g for g in groups if g["category"] == "bird"]
    frogs = [g for g in groups if g["category"] == "frog"]
    assert len(birds) == 1 and len(frogs) == 1
    assert birds[0]["end_time"] == 2.88
    assert birds[0]["raw_score"] == 0.7  # highest score's label kept
    assert frogs[0]["raw_score"] == 0.6


def test_merge_frames_split_by_gap():
    classifier = make_classifier()
    events = [
        {"category": "bird", "yamnet_label": "Bird", "raw_score": 0.5, "frame": 0,
         "start_time": 0.0, "end_time": 0.96},
        {"category": "bird", "yamnet_label": "Bird", "raw_score": 0.5, "frame": 10,
         "start_time": 4.8, "end_time": 5.76},  # gap > MERGE_GAP_SECONDS
    ]
    assert len(classifier._merge_frames(events)) == 2


def test_assign_species_matches_frequency_band():
    classifier = make_classifier()
    sr = 16000
    waveform = (0.5 * np.sin(2 * np.pi * 2000 * np.arange(sr * 2) / sr)).astype(np.float32)

    group = {"category": "bird", "yamnet_label": "Bird", "raw_score": 0.6,
             "start_time": 0.0, "end_time": 2.0}
    det = classifier._assign_species(group, waveform, sr)

    assert det["dominant_hz"] == 2000.0
    candidates = {s["scientific_name"]: (s["freq_low_hz"], s["freq_high_hz"])
                  for s in candidates_for_category("bird")}
    band_low, band_high = candidates[det["species_name"]]
    assert band_low <= 2000 <= band_high
    # In-band match gets the higher prior.
    assert det["confidence"] == round(min(0.6 * 0.95, 0.99), 3)


def test_assign_species_silent_segment_is_unidentified():
    classifier = make_classifier()
    sr = 16000
    silence = np.zeros(sr * 2, dtype=np.float32)
    group = {"category": "bird", "yamnet_label": "Bird", "raw_score": 0.6,
             "start_time": 0.0, "end_time": 2.0}
    det = classifier._assign_species(group, silence, sr)
    assert det["species_name"] == "Unidentified bird"


def test_category_frame_events_threshold():
    classifier = make_classifier()
    n_frames = 5
    scores = np.zeros((n_frames, 521), dtype=np.float32)
    scores[:, BIRD_IDX] = 0.4   # above 0.3, below 0.5
    scores[:, FROG_IDX] = 0.2

    events = classifier._category_frame_events(scores, threshold=0.3)
    assert len(events) == n_frames
    assert all(e["category"] == "bird" for e in events)

    events_strict = classifier._category_frame_events(scores, threshold=0.5)
    assert events_strict == []
