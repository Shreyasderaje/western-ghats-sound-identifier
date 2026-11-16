"""Report generation tests (no model, no HTTP)."""
import csv

import pytest

from report_generator import compute_summary, generate_csv_report, generate_pdf_report

SAMPLE_DETECTIONS = [
    {"species_name": "Harpactes fasciatus", "common_name": "Malabar Trogon",
     "category": "bird", "start_time": 0.5, "end_time": 2.4, "confidence": 0.52},
    {"species_name": "Harpactes fasciatus", "common_name": "Malabar Trogon",
     "category": "bird", "start_time": 8.0, "end_time": 9.5, "confidence": 0.61},
    {"species_name": "Hoplobatrachus tigerinus", "common_name": "Indian Bullfrog",
     "category": "frog", "start_time": 5.0, "end_time": 6.8, "confidence": 0.30},
]


def test_summary_statistics():
    summary = compute_summary(SAMPLE_DETECTIONS, duration_seconds=10.0)
    assert summary["total_detections"] == 3
    assert summary["unique_species"] == 2
    assert summary["birds"] == 1
    assert summary["frogs"] == 1
    # Shannon for {2/3, 1/3}: -(2/3 ln 2/3 + 1/3 ln 1/3) ~= 0.6365
    assert abs(summary["shannon_diversity"] - 0.6365) < 0.001

    trogon = next(e for e in summary["per_species"] if e["count"] == 2)
    assert trogon["species_name"] == "Harpactes fasciatus"
    assert abs(trogon["avg_confidence"] - 0.565) < 1e-9
    assert trogon["max_confidence"] == 0.61


def test_summary_empty():
    summary = compute_summary([], duration_seconds=0)
    assert summary["total_detections"] == 0
    assert summary["unique_species"] == 0
    assert summary["shannon_diversity"] == 0.0


def test_csv_report(tmp_path):
    out = tmp_path / "report.csv"
    recording = {"file_id": "abc123", "filename": "tone.wav", "location": "Agumbe", "duration": 10.0}
    generate_csv_report(recording, SAMPLE_DETECTIONS, out)

    text = out.read_text(encoding="utf-8")
    assert "Harpactes fasciatus" in text
    assert "shannon_diversity" in text

    rows = [r for r in csv.DictReader(text.splitlines()[text.splitlines().index("# Detections") + 1:])
            if r.get("species_name")]
    assert len(rows) == 3


def test_pdf_report_without_spectrogram(tmp_path):
    out = tmp_path / "report.pdf"
    recording = {"file_id": "abc123", "filename": "tone.wav", "location": None,
                 "upload_date": "2026-10-18", "duration": 10.0, "sample_rate": 16000}
    generate_pdf_report(recording, SAMPLE_DETECTIONS, None, out)
    assert out.read_bytes()[:5] == b"%PDF-"


def test_pdf_report_with_missing_spectrogram_file(tmp_path):
    out = tmp_path / "report.pdf"
    recording = {"file_id": "abc123", "filename": "tone.wav", "duration": 10.0}
    # Path points nowhere: report must still build (image dropped gracefully).
    generate_pdf_report(recording, SAMPLE_DETECTIONS, tmp_path / "missing.png", out)
    assert out.read_bytes()[:5] == b"%PDF-"


@pytest.mark.parametrize("counts,expected", [([1], 0.0), ([1, 1], 0.6931), ([2, 1], 0.6365)])
def test_shannon_math(counts, expected):
    detections = []
    for i, n in enumerate(counts):
        for j in range(n):
            detections.append({
                "species_name": f"sp{i}", "category": "bird",
                "start_time": float(j), "end_time": float(j) + 1,
                "confidence": 0.5,
            })
    assert abs(compute_summary(detections)["shannon_diversity"] - expected) < 0.001
