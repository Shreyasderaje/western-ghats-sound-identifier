"""PDF and CSV report generation (reportlab + pandas).

The PDF contains recording metadata, summary statistics, a species table,
the Shannon diversity index and the annotated spectrogram. The CSV contains
every detection followed by a summary block.
"""
import logging
from datetime import datetime

import numpy as np
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Summary statistics
# ---------------------------------------------------------------------------

def compute_summary(detections: list, duration_seconds=None) -> dict:
    """Aggregate detection events into the stats shown on results and reports."""
    per_species = {}
    for det in detections:
        entry = per_species.setdefault(
            det["species_name"],
            {
                "species_name": det["species_name"],
                "common_name": det.get("common_name"),
                "category": det.get("category"),
                "count": 0,
                "confidences": [],
                "first_seen": det["start_time"],
                "last_seen": det["end_time"],
            },
        )
        entry["count"] += 1
        entry["confidences"].append(det["confidence"])
        entry["last_seen"] = max(entry["last_seen"], det["end_time"])

    for entry in per_species.values():
        confidences = entry.pop("confidences")
        entry["avg_confidence"] = float(np.mean(confidences))
        entry["max_confidence"] = float(np.max(confidences))

    counts = np.array([e["count"] for e in per_species.values()], dtype=float)
    if counts.size:
        proportions = counts / counts.sum()
        shannon = float(-np.sum(proportions * np.log(proportions))) + 0.0  # avoid -0.0
    else:
        shannon = 0.0

    return {
        "total_detections": len(detections),
        "unique_species": len(per_species),
        "birds": sum(1 for e in per_species.values() if e.get("category") == "bird"),
        "frogs": sum(1 for e in per_species.values() if e.get("category") == "frog"),
        "shannon_diversity": round(shannon, 3),
        "recording_duration": duration_seconds,
        "per_species": sorted(
            per_species.values(), key=lambda e: (-e["count"], e["species_name"])
        ),
    }


def _diversity_label(shannon: float) -> str:
    if shannon < 0.7:
        return "low"
    if shannon < 1.5:
        return "moderate"
    return "high"


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

def _confidence_badge(score: float) -> str:
    if score >= 0.7:
        return "High"
    if score >= 0.4:
        return "Medium"
    return "Low"


def generate_pdf_report(
    recording_dict: dict,
    detections: list,
    spectrogram_path,
    output_path,
) -> str:
    """Write the biodiversity PDF report; returns the output path."""
    styles = getSampleStyleSheet()
    heading = ParagraphStyle(
        "ReportHeading", parent=styles["Title"], fontSize=18, spaceAfter=4
    )
    muted = ParagraphStyle("Muted", parent=styles["Normal"], textColor=colors.grey)

    summary = compute_summary(detections, recording_dict.get("duration"))
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        title="Western Ghats Sound Identifier — Biodiversity Report",
    )

    story = [
        Paragraph("Western Ghats Sound Identifier", heading),
        Paragraph("Biodiversity Analysis Report", styles["Heading2"]),
        Paragraph(
            f"Generated {datetime.now().strftime('%d %b %Y %H:%M')}", muted
        ),
        Spacer(1, 0.6 * cm),
    ]

    # Recording metadata
    meta_rows = [
        ["Recording file", recording_dict.get("filename", "-")],
        ["Uploaded", recording_dict.get("upload_date", "-")],
        ["Location", recording_dict.get("location") or "Not specified"],
        ["Duration", f"{recording_dict.get('duration') or 0:.1f} s"
         if recording_dict.get("duration") else "-"],
        ["Sample rate", f"{recording_dict.get('sample_rate')} Hz"
         if recording_dict.get("sample_rate") else "-"],
    ]
    story += [_kv_table(meta_rows), Spacer(1, 0.5 * cm)]

    # Summary statistics
    story.append(Paragraph("Summary", styles["Heading3"]))
    stat_rows = [
        ["Total call events", str(summary["total_detections"])],
        ["Unique species detected", str(summary["unique_species"])],
        ["Bird species", str(summary["birds"])],
        ["Frog species", str(summary["frogs"])],
        [
            "Shannon diversity index",
            f"{summary['shannon_diversity']:.3f} "
            f"({_diversity_label(summary['shannon_diversity'])})",
        ],
    ]
    story += [_kv_table(stat_rows), Spacer(1, 0.5 * cm)]

    # Species table
    story.append(Paragraph("Detected Species", styles["Heading3"]))
    if summary["per_species"]:
        header = ["Species", "Scientific name", "Type", "Calls", "Avg conf.", "Confidence"]
        rows = [header]
        for entry in summary["per_species"]:
            rows.append(
                [
                    entry["common_name"] or entry["species_name"],
                    entry["species_name"],
                    (entry.get("category") or "-").capitalize(),
                    str(entry["count"]),
                    f"{entry['avg_confidence']:.2f}",
                    _confidence_badge(entry["avg_confidence"]),
                ]
            )
        table = Table(rows, colWidths=[4.4 * cm, 4.4 * cm, 1.6 * cm, 1.4 * cm, 2.0 * cm, 2.2 * cm])
        table.setStyle(_table_style())
        story += [table]
    else:
        story.append(
            Paragraph(
                "No bird or frog calls were detected above the confidence "
                "threshold in this recording.",
                styles["Normal"],
            )
        )

    story += [Spacer(1, 0.6 * cm), Paragraph("Spectrogram", styles["Heading3"])]

    if spectrogram_path:
        story.append(Image(str(spectrogram_path), width=17 * cm, height=6.4 * cm))
    else:
        story.append(Paragraph("Spectrogram was not generated.", styles["Normal"]))

    try:
        doc.build(story)
    except Exception:
        # A missing/oversized image should not lose the report; retry without it.
        logger.exception("PDF build failed; retrying without the spectrogram image")
        story = [s for s in story if not isinstance(s, Image)]
        doc = SimpleDocTemplate(str(output_path), pagesize=A4)
        doc.build(story)

    logger.info("PDF report written to %s", output_path)
    return str(output_path)


def _kv_table(rows):
    table = Table(rows, colWidths=[5.0 * cm, 12.0 * cm])
    table.setStyle(_table_style())
    return table


def _table_style():
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a7a4a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f7f2")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d8cd")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
    )


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

def generate_csv_report(
    recording_dict: dict, detections: list, output_path
) -> str:
    """Write detections + summary statistics as CSV; returns the output path."""
    summary = compute_summary(detections, recording_dict.get("duration"))

    detections_df = pd.DataFrame(
        [
            {
                "recording_id": recording_dict.get("file_id"),
                "recording_file": recording_dict.get("filename"),
                "species_name": det["species_name"],
                "common_name": det.get("common_name"),
                "category": det.get("category"),
                "start_time_s": det["start_time"],
                "end_time_s": det["end_time"],
                "confidence": det["confidence"],
                "yamnet_label": det.get("yamnet_label"),
            }
            for det in detections
        ]
    )

    metadata_df = pd.DataFrame(
        [
            ["recording_id", recording_dict.get("file_id")],
            ["recording_file", recording_dict.get("filename")],
            ["location", recording_dict.get("location") or ""],
            ["duration_s", recording_dict.get("duration")],
            ["total_detections", summary["total_detections"]],
            ["unique_species", summary["unique_species"]],
            ["bird_species", summary["birds"]],
            ["frog_species", summary["frogs"]],
            ["shannon_diversity", summary["shannon_diversity"]],
            ["generated_at", datetime.now().isoformat(timespec="seconds")],
        ],
        columns=["field", "value"],
    )

    with open(output_path, "w", newline="", encoding="utf-8") as handle:
        handle.write("# Western Ghats Sound Identifier - Detection Export\n")
        metadata_df.to_csv(handle, index=False)
        handle.write("\n# Detections\n")
        if detections_df.empty:
            pd.DataFrame(columns=detections_df.columns).to_csv(handle, index=False)
        else:
            detections_df.to_csv(handle, index=False)

    logger.info("CSV report written to %s", output_path)
    return str(output_path)
