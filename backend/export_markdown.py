"""
Export Markdown Reports - Build dynamic markdown and PNG outputs for each patient.
"""
from __future__ import annotations

import json
import math
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
import numpy as np

from .config import CLINICAL_THRESHOLDS, FRONTEND_PUBLIC, PROJECT_ROOT

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


INDEX_FILENAME = "Hasta_Raporları_Detay.md"


@dataclass
class PatientArtifacts:
    code: str
    report_path: Path
    kmr_chart: Path
    lab_chart: Path
    risk_chart: Path


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        v = float(value)
        if not math.isfinite(v):
            return None
        return v
    except (TypeError, ValueError):
        return None


def _num_or_nan(value: Any) -> float:
    v = _safe_float(value)
    return np.nan if v is None else float(v)


def _fmt_num(value: Any, digits: int = 2) -> str:
    v = _safe_float(value)
    if v is None:
        return "-"
    return f"{v:.{digits}f}"


def _fmt_pct(value: Any, digits: int = 1) -> str:
    v = _safe_float(value)
    if v is None:
        return "-"
    return f"%{v:.{digits}f}"


def _time_label(time_key: str) -> str:
    base = str(time_key).replace("_KRE", "").replace("_GFR", "")
    if base in {"", "-", "None", "null"}:
        return "-"
    if base.startswith("Day_"):
        return f"{base.split('_', 1)[1]}. Gun"
    if base.startswith("Week_"):
        return f"{base.split('_', 1)[1]}. Hafta"
    if base.startswith("Month_"):
        return f"{base.split('_', 1)[1]}. Ay"
    return base


def _iqr_stats(values: List[Any]) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    cleaned = [_safe_float(v) for v in values]
    arr = np.array([v for v in cleaned if v is not None], dtype=float)
    if arr.size == 0:
        return None, None, None
    q1 = float(np.percentile(arr, 25))
    med = float(np.percentile(arr, 50))
    q3 = float(np.percentile(arr, 75))
    return med, q1, q3


def _status_label(status: str) -> str:
    mapping = {
        "ok": "Model",
        "forecast": "Ongoru",
        "warmup_copy": "Olcum Kopyasi",
        "warmup_bootstrap": "Warmup",
        "fallback_ewma": "EWMA Yedek",
        "fallback_forecast": "Yedek Ongoru",
        "insufficient_data": "Yetersiz Veri",
        "missing_prediction": "Tahmin Yok",
        "timepoint_not_applicable": "Uygulanmaz",
    }
    return mapping.get(status or "", status or "-")


def _is_kmr_threshold_anomaly(value: Any) -> bool:
    v = _safe_float(value)
    return v is not None and (v > CLINICAL_THRESHOLDS["kmr"]["kritik_upper"] or v < 0.0)


def _is_kre_threshold_anomaly(value: Any) -> bool:
    v = _safe_float(value)
    return v is not None and (v > CLINICAL_THRESHOLDS["kre"]["very_bad_gt"] or v < 0.0)


def _is_gfr_threshold_anomaly(value: Any) -> bool:
    v = _safe_float(value)
    return v is not None and (v < CLINICAL_THRESHOLDS["gfr"]["very_bad_le"] or v > 120.0)


class MarkdownReportExporter:
    """Generate dynamic markdown reports and chart assets from frontend/public JSON files."""

    def __init__(self, public_dir: Optional[Path] = None, doc_dir: Optional[Path] = None) -> None:
        self.public_dir = public_dir or FRONTEND_PUBLIC
        self.doc_dir = doc_dir or (PROJECT_ROOT / "Doc")
        self.reports_dir = self.doc_dir / "reports"
        self.reports_patients_dir = self.reports_dir / "patients"
        self.reports_assets_dir = self.reports_dir / "assets"
        self.index_path = self.doc_dir / INDEX_FILENAME

    @classmethod
    def clean_outputs(cls, doc_dir: Optional[Path] = None) -> None:
        """Remove previously generated markdown report artifacts."""
        target_doc_dir = doc_dir or (PROJECT_ROOT / "Doc")
        report_root = target_doc_dir / "reports"
        report_index = target_doc_dir / INDEX_FILENAME
        if report_root.exists():
            shutil.rmtree(report_root, ignore_errors=True)
        if report_index.exists():
            report_index.unlink()

    def _load_json(self, path: Path) -> Dict[str, Any]:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}

    def _build_reference_lookup(self, ref_band: Dict[str, Any]) -> Dict[str, Dict[str, Dict[str, Any]]]:
        lookup: Dict[str, Dict[str, Dict[str, Any]]] = {"kmr": {}, "kre": {}, "gfr": {}}
        bands = ref_band.get("bands", {}) if isinstance(ref_band, dict) else {}
        for metric in ("kmr", "kre", "gfr"):
            arr = bands.get(metric, [])
            if not isinstance(arr, list):
                continue
            for item in arr:
                if not isinstance(item, dict):
                    continue
                key = str(item.get("time_key") or "")
                base_key = key.replace("_KRE", "").replace("_GFR", "")
                if base_key:
                    lookup[metric][base_key] = item
        return lookup

    def _render_kmr_chart(
        self,
        patient_code: str,
        timeline: List[Dict[str, Any]],
        ref_lookup: Dict[str, Dict[str, Dict[str, Any]]],
    ) -> Path:
        x = np.arange(len(timeline))
        labels = [_time_label(str(point.get("time_key", ""))) for point in timeline]

        kmr_actual = np.array([_num_or_nan(point.get("kmr")) for point in timeline], dtype=float)
        kmr_pred = np.array([_num_or_nan(point.get("kmr_pred")) for point in timeline], dtype=float)
        kmr_lo = np.array([_num_or_nan(point.get("kmr_pred_lo")) for point in timeline], dtype=float)
        kmr_hi = np.array([_num_or_nan(point.get("kmr_pred_hi")) for point in timeline], dtype=float)

        ref_med = np.array(
            [_num_or_nan(ref_lookup["kmr"].get(str(point.get("time_key")), {}).get("median")) for point in timeline],
            dtype=float,
        )
        ref_q1 = np.array(
            [_num_or_nan(ref_lookup["kmr"].get(str(point.get("time_key")), {}).get("p25")) for point in timeline],
            dtype=float,
        )
        ref_q3 = np.array(
            [_num_or_nan(ref_lookup["kmr"].get(str(point.get("time_key")), {}).get("p75")) for point in timeline],
            dtype=float,
        )

        fig, ax = plt.subplots(figsize=(14, 4.8))
        ax.fill_between(x, ref_q1, ref_q3, color="#E3F2FD", alpha=0.9, label="Referans IQR (P25-P75)")
        ax.plot(x, ref_med, color="#1E88E5", linewidth=1.6, label="Referans Median")
        ax.plot(x, kmr_actual, color="#2E7D32", marker="o", linewidth=2.0, label="KMR Olcum")
        ax.plot(x, kmr_pred, color="#EF6C00", linestyle="--", linewidth=1.6, marker=".", label="AI KMR Tahmin")
        ax.fill_between(x, kmr_lo, kmr_hi, color="#FFE0B2", alpha=0.6, label="AI Tahmin Araligi")

        anomaly_idx = [i for i, p in enumerate(timeline) if bool(p.get("kmr_anomaly_flag")) or _is_kmr_threshold_anomaly(p.get("kmr"))]
        if anomaly_idx:
            anomaly_vals = [kmr_actual[i] for i in anomaly_idx]
            ax.scatter(anomaly_idx, anomaly_vals, color="#D32F2F", marker="x", s=54, label="KMR Anomali")

        ax.set_title(f"Hasta {patient_code} - KMR Seyri (Gercek/AI/Referans)")
        ax.set_ylabel("KMR")
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha="right")
        ax.grid(alpha=0.25)
        ax.legend(loc="upper right", ncol=2, fontsize=8)
        ax.set_ylim(bottom=0)
        fig.tight_layout()

        output_path = self.reports_assets_dir / f"{patient_code}_kmr.png"
        fig.savefig(output_path, dpi=140)
        plt.close(fig)
        return output_path

    def _render_lab_chart(
        self,
        patient_code: str,
        timeline: List[Dict[str, Any]],
        ref_lookup: Dict[str, Dict[str, Dict[str, Any]]],
    ) -> Path:
        x = np.arange(len(timeline))
        labels = [_time_label(str(point.get("time_key", ""))) for point in timeline]

        fig, axes = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
        for idx, metric in enumerate(("kre", "gfr")):
            ax = axes[idx]
            actual = np.array([_num_or_nan(point.get(metric)) for point in timeline], dtype=float)
            pred = np.array([_num_or_nan(point.get(f"{metric}_pred")) for point in timeline], dtype=float)
            pred_lo = np.array([_num_or_nan(point.get(f"{metric}_pred_lo")) for point in timeline], dtype=float)
            pred_hi = np.array([_num_or_nan(point.get(f"{metric}_pred_hi")) for point in timeline], dtype=float)
            ref_median = np.array(
                [_num_or_nan(ref_lookup[metric].get(str(point.get("time_key")), {}).get("median")) for point in timeline],
                dtype=float,
            )
            ref_q1 = np.array(
                [_num_or_nan(ref_lookup[metric].get(str(point.get("time_key")), {}).get("p25")) for point in timeline],
                dtype=float,
            )
            ref_q3 = np.array(
                [_num_or_nan(ref_lookup[metric].get(str(point.get("time_key")), {}).get("p75")) for point in timeline],
                dtype=float,
            )

            metric_name = metric.upper()
            ax.fill_between(x, ref_q1, ref_q3, color="#E8F5E9", alpha=0.85, label=f"{metric_name} Referans IQR")
            ax.plot(x, ref_median, color="#43A047", linewidth=1.5, label=f"{metric_name} Referans Median")
            ax.plot(x, actual, color="#1565C0", marker="o", linewidth=1.9, label=f"{metric_name} Olcum")
            ax.plot(x, pred, color="#6A1B9A", linestyle="--", linewidth=1.5, marker=".", label=f"AI {metric_name} Tahmin")
            ax.fill_between(x, pred_lo, pred_hi, color="#E1BEE7", alpha=0.5, label=f"AI {metric_name} Aralik")

            if metric == "kre":
                anomaly_idx = [
                    i
                    for i, point in enumerate(timeline)
                    if bool(point.get("kre_anomaly_flag")) or _is_kre_threshold_anomaly(point.get("kre"))
                ]
            else:
                anomaly_idx = [
                    i
                    for i, point in enumerate(timeline)
                    if bool(point.get("gfr_anomaly_flag")) or _is_gfr_threshold_anomaly(point.get("gfr"))
                ]

            if anomaly_idx:
                anomaly_vals = [actual[i] for i in anomaly_idx]
                ax.scatter(anomaly_idx, anomaly_vals, color="#C62828", marker="x", s=46, label=f"{metric_name} Anomali")

            ax.grid(alpha=0.25)
            ax.set_ylabel(metric_name)
            ax.legend(loc="upper right", ncol=2, fontsize=7)

        axes[-1].set_xticks(x)
        axes[-1].set_xticklabels(labels, rotation=45, ha="right")
        axes[0].set_title(f"Hasta {patient_code} - KRE/GFR Seyri (Gercek/AI/Referans)")
        fig.tight_layout()

        output_path = self.reports_assets_dir / f"{patient_code}_kre_gfr.png"
        fig.savefig(output_path, dpi=140)
        plt.close(fig)
        return output_path

    def _render_risk_chart(
        self,
        patient_code: str,
        timeline: List[Dict[str, Any]],
        alarm_thresholds: Dict[str, Any],
    ) -> Path:
        x = np.arange(len(timeline))
        labels = [_time_label(str(point.get("time_key", ""))) for point in timeline]
        risk_values = np.array([_num_or_nan(point.get("risk_score")) for point in timeline], dtype=float)

        dikkat = _safe_float(alarm_thresholds.get("dikkat")) or 30.0
        kritik = _safe_float(alarm_thresholds.get("kritik")) or 60.0
        cok_kritik = _safe_float(alarm_thresholds.get("cok_kritik")) or 80.0

        fig, ax = plt.subplots(figsize=(14, 4.0))
        ax.plot(x, risk_values, color="#455A64", marker="o", linewidth=2.0, label="Risk Skoru")
        ax.axhline(dikkat, color="#F9A825", linestyle="--", linewidth=1.2, label="Dikkat Esik")
        ax.axhline(kritik, color="#EF6C00", linestyle="--", linewidth=1.2, label="Kritik Esik")
        ax.axhline(cok_kritik, color="#C62828", linestyle="--", linewidth=1.2, label="Cok Kritik Esik")
        ax.set_ylim(0, 100)
        ax.set_ylabel("Risk")
        ax.set_title(f"Hasta {patient_code} - Risk Seyri")
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha="right")
        ax.grid(alpha=0.25)
        ax.legend(loc="upper right", ncol=2, fontsize=8)
        fig.tight_layout()

        output_path = self.reports_assets_dir / f"{patient_code}_risk.png"
        fig.savefig(output_path, dpi=140)
        plt.close(fig)
        return output_path

    def _build_metric_reference_row(
        self,
        timeline: List[Dict[str, Any]],
        ref_lookup: Dict[str, Dict[str, Dict[str, Any]]],
        metric: str,
    ) -> Tuple[str, str, str]:
        series = [_safe_float(point.get(metric)) for point in timeline]
        med, q1, q3 = _iqr_stats(series)
        patient_iqr = None if q1 is None or q3 is None else (q3 - q1)

        last_time_key = None
        for point in reversed(timeline):
            if _safe_float(point.get(metric)) is not None:
                last_time_key = str(point.get("time_key"))
                break

        ref_median = None
        ref_iqr = None
        if last_time_key:
            ref_entry = ref_lookup[metric].get(last_time_key, {})
            ref_median = _safe_float(ref_entry.get("median"))
            ref_q1 = _safe_float(ref_entry.get("p25"))
            ref_q3 = _safe_float(ref_entry.get("p75"))
            if ref_q1 is not None and ref_q3 is not None:
                ref_iqr = ref_q3 - ref_q1

        return (
            f"{_fmt_num(med, 3)} / {_fmt_num(patient_iqr, 3)}",
            f"{_fmt_num(ref_median, 3)} / {_fmt_num(ref_iqr, 3)}",
            _time_label(last_time_key) if last_time_key else "-",
        )

    def _build_timeline_table(self, timeline: List[Dict[str, Any]]) -> List[str]:
        lines = [
            "| Zaman | KMR | AI KMR | Durum | KRE | AI KRE | Durum | GFR | AI GFR | Durum | Risk | Seviye | Anomali |",
            "|---|---:|---:|---|---:|---:|---|---:|---:|---|---:|---|---|",
        ]
        for point in timeline:
            kmr_anom = bool(point.get("kmr_anomaly_flag")) or _is_kmr_threshold_anomaly(point.get("kmr"))
            kre_anom = bool(point.get("kre_anomaly_flag")) or _is_kre_threshold_anomaly(point.get("kre"))
            gfr_anom = bool(point.get("gfr_anomaly_flag")) or _is_gfr_threshold_anomaly(point.get("gfr"))
            anomaly_parts = []
            if kmr_anom:
                anomaly_parts.append("KMR")
            if kre_anom:
                anomaly_parts.append("KRE")
            if gfr_anom:
                anomaly_parts.append("GFR")
            anomaly_text = ",".join(anomaly_parts) if anomaly_parts else "-"

            lines.append(
                "| "
                + " | ".join(
                    [
                        _time_label(str(point.get("time_key", "-"))),
                        _fmt_num(point.get("kmr"), 4),
                        _fmt_num(point.get("kmr_pred"), 4),
                        _status_label(str(point.get("kmr_pred_status", ""))),
                        _fmt_num(point.get("kre"), 2),
                        _fmt_num(point.get("kre_pred"), 2),
                        _status_label(str(point.get("kre_pred_status", ""))),
                        _fmt_num(point.get("gfr"), 1),
                        _fmt_num(point.get("gfr_pred"), 1),
                        _status_label(str(point.get("gfr_pred_status", ""))),
                        _fmt_num(point.get("risk_score"), 1),
                        str(point.get("risk_level", "-")),
                        anomaly_text,
                    ]
                )
                + " |"
            )
        return lines

    def _write_patient_markdown(
        self,
        patient: Dict[str, Any],
        timeline: List[Dict[str, Any]],
        feature: Dict[str, Any],
        doctor_row: Dict[str, Any],
        artifacts: PatientArtifacts,
        ref_lookup: Dict[str, Dict[str, Dict[str, Any]]],
    ) -> None:
        meta = patient.get("meta", {})
        last_status = patient.get("last_status", {})

        kmr_patient_vs_ref, kmr_ref, kmr_time = self._build_metric_reference_row(timeline, ref_lookup, "kmr")
        kre_patient_vs_ref, kre_ref, kre_time = self._build_metric_reference_row(timeline, ref_lookup, "kre")
        gfr_patient_vs_ref, gfr_ref, gfr_time = self._build_metric_reference_row(timeline, ref_lookup, "gfr")

        lines = [
            f"# Hasta {meta.get('patient_code', '-')}",
            "",
            "[Ana rapora don](../../Hasta_Raporları_Detay.md)",
            "",
            "## Hasta Ozeti",
            "",
            "| Alan | Deger |",
            "|---|---|",
            f"| Yas | {meta.get('age', '-')} |",
            f"| Cinsiyet | {meta.get('gender', '-')} |",
            f"| BMI | {_fmt_num(meta.get('BMI'), 1)} |",
            f"| Vital Status | {meta.get('vital_status', '-')} |",
            f"| Risk Skoru (Son) | {_fmt_num(feature.get('risk_score'), 1)} |",
            f"| Risk Seviyesi | {feature.get('risk_level', '-')} |",
            f"| Anomali Durumu | {'Var' if feature.get('has_anomaly') else 'Yok'} |",
            f"| Son KMR | {_fmt_num(last_status.get('kmr_last'), 4)} ({_time_label(last_status.get('last_kmr_order') and next((p.get('time_key') for p in timeline if p.get('time_order') == last_status.get('last_kmr_order')), '-'))}) |",
            f"| Son KRE | {_fmt_num(last_status.get('kre_last'), 2)} ({_time_label(last_status.get('last_kre_order') and next((p.get('time_key') for p in timeline if p.get('time_order') == last_status.get('last_kre_order')), '-'))}) |",
            f"| Son GFR | {_fmt_num(last_status.get('gfr_last'), 1)} ({_time_label(last_status.get('last_gfr_order') and next((p.get('time_key') for p in timeline if p.get('time_order') == last_status.get('last_gfr_order')), '-'))}) |",
            "",
            "## Grafikler",
            "",
            f"![Hasta {meta.get('patient_code', '')} KMR](../assets/{artifacts.kmr_chart.name})",
            "",
            f"![Hasta {meta.get('patient_code', '')} KRE GFR](../assets/{artifacts.lab_chart.name})",
            "",
            f"![Hasta {meta.get('patient_code', '')} Risk](../assets/{artifacts.risk_chart.name})",
            "",
            "## IQR ve Median Ozeti",
            "",
            "| Metrik | Hasta (Median / IQR) | Referans (Median / IQR) | Son Olcum Zamani |",
            "|---|---|---|---|",
            f"| KMR | {kmr_patient_vs_ref} | {kmr_ref} | {kmr_time} |",
            f"| KRE | {kre_patient_vs_ref} | {kre_ref} | {kre_time} |",
            f"| GFR | {gfr_patient_vs_ref} | {gfr_ref} | {gfr_time} |",
            "",
            "## AI Performans (Hasta Bazli)",
            "",
            "| Metrik | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama | Son Hata |",
            "|---|---:|---:|---:|---:|---:|---:|",
            f"| KMR | {doctor_row.get('kmr', {}).get('n_eval_points', 0)} | {_fmt_num(doctor_row.get('kmr', {}).get('mae'), 4)} | {_fmt_num(doctor_row.get('kmr', {}).get('rmse'), 4)} | {_fmt_pct(doctor_row.get('kmr', {}).get('mape_percent'), 2)} | {_fmt_pct((_safe_float(doctor_row.get('kmr', {}).get('interval_coverage')) or 0.0) * 100.0, 1)} | {_fmt_num(doctor_row.get('kmr', {}).get('last_error'), 4)} |",
            f"| KRE | {doctor_row.get('kre', {}).get('n_eval_points', 0)} | {_fmt_num(doctor_row.get('kre', {}).get('mae'), 3)} | {_fmt_num(doctor_row.get('kre', {}).get('rmse'), 3)} | {_fmt_pct(doctor_row.get('kre', {}).get('mape_percent'), 2)} | {_fmt_pct((_safe_float(doctor_row.get('kre', {}).get('interval_coverage')) or 0.0) * 100.0, 1)} | {_fmt_num(doctor_row.get('kre', {}).get('last_error'), 3)} |",
            f"| GFR | {doctor_row.get('gfr', {}).get('n_eval_points', 0)} | {_fmt_num(doctor_row.get('gfr', {}).get('mae'), 2)} | {_fmt_num(doctor_row.get('gfr', {}).get('rmse'), 2)} | {_fmt_pct(doctor_row.get('gfr', {}).get('mape_percent'), 2)} | {_fmt_pct((_safe_float(doctor_row.get('gfr', {}).get('interval_coverage')) or 0.0) * 100.0, 1)} | {_fmt_num(doctor_row.get('gfr', {}).get('last_error'), 2)} |",
            "",
            "## Zaman Serisi Detay Tablosu",
            "",
        ]
        lines.extend(self._build_timeline_table(timeline))
        lines.append("")
        lines.append("> Not: Bu dosya `python3 backend/run_all.py` ile otomatik uretilir.")
        lines.append("")

        artifacts.report_path.write_text("\n".join(lines), encoding="utf-8")

    def _write_index_markdown(
        self,
        created_at: str,
        data_summary: Dict[str, Any],
        doctor_report: Dict[str, Any],
        artifacts: List[PatientArtifacts],
        feature_map: Dict[str, Dict[str, Any]],
    ) -> None:
        totals = data_summary.get("totals", {})
        averages = data_summary.get("averages", {})
        risk_distribution = data_summary.get("risk_distribution", {})
        doctor_summary = doctor_report.get("summary", {})
        doctor_metrics = doctor_summary.get("metrics", {})

        lines = [
            "# Hasta_Raporları_Detay",
            "",
            f"Uretim Zamani: `{created_at}`",
            "",
            "Bu indeks ve alt raporlar dinamik olarak `run_all.py` tarafindan uretilir.",
            "",
            "## Sistem Ozet KPI",
            "",
            "| KPI | Deger |",
            "|---|---:|",
            f"| Toplam Hasta | {totals.get('n_patients', 0)} |",
            f"| Iyilesmis Proxy Hasta | {totals.get('improved_proxy_count', 0)} |",
            f"| Anomalili Hasta | {totals.get('patients_with_anomalies', 0)} |",
            f"| Ortalama Risk | {_fmt_num(averages.get('risk_score'), 2)} |",
            f"| Ortalama Son KMR | {_fmt_num(averages.get('kmr_last'), 4)} |",
            f"| Ortalama Son KRE | {_fmt_num(averages.get('kre_last'), 2)} |",
            f"| Ortalama Son GFR | {_fmt_num(averages.get('gfr_last'), 1)} |",
            "",
            "## Risk Dagilimi",
            "",
            "| Seviye | Hasta Sayisi |",
            "|---|---:|",
            f"| Normal | {risk_distribution.get('Normal', 0)} |",
            f"| Dikkat | {risk_distribution.get('Dikkat', 0)} |",
            f"| Kritik | {risk_distribution.get('Kritik', 0)} |",
            f"| Cok Kritik | {risk_distribution.get('Çok Kritik', 0)} |",
            "",
            "## AI Performans Ozeti (Doktor Paneli)",
            "",
            "| Metrik | Eval Hasta | Eval Nokta | MAE | RMSE | MAPE | Aralik Kapsama |",
            "|---|---:|---:|---:|---:|---:|---:|",
        ]
        for metric in ("kmr", "kre", "gfr"):
            item = doctor_metrics.get(metric, {})
            lines.append(
                f"| {metric.upper()} | "
                f"{item.get('patients_with_eval', 0)} | "
                f"{item.get('total_eval_points', 0)} | "
                f"{_fmt_num(item.get('mae'), 4)} | "
                f"{_fmt_num(item.get('rmse'), 4)} | "
                f"{_fmt_pct(item.get('mape_percent'), 2)} | "
                f"{_fmt_pct((_safe_float(item.get('interval_coverage')) or 0.0) * 100.0, 1)} |"
            )

        lines.extend(
            [
                "",
                "## Hasta Bazli Raporlar",
                "",
                "| Hasta | Risk | Seviye | Anomali | Son KMR | Son KRE | Son GFR | Rapor |",
                "|---|---:|---|---|---|---|---|---|",
            ]
        )

        sorted_artifacts = sorted(
            artifacts,
            key=lambda a: (
                -(_safe_float(feature_map.get(a.code, {}).get("risk_score")) or 0.0),
                a.code,
            ),
        )
        for artifact in sorted_artifacts:
            feature = feature_map.get(artifact.code, {})
            risk = _fmt_num(feature.get("risk_score"), 1)
            level = str(feature.get("risk_level", "-"))
            anomaly = "Var" if feature.get("has_anomaly") else "Yok"
            last_kmr = f"{_fmt_num(feature.get('last_kmr'), 4)} ({_time_label(str(feature.get('last_kmr_time_key', '-')))})"
            last_kre = f"{_fmt_num(feature.get('last_kre'), 2)} ({_time_label(str(feature.get('last_kre_time_key', '-')))})"
            last_gfr = f"{_fmt_num(feature.get('last_gfr'), 1)} ({_time_label(str(feature.get('last_gfr_time_key', '-')))})"
            rel_report = f"reports/patients/{artifact.code}.md"
            lines.append(
                f"| {artifact.code} | {risk} | {level} | {anomaly} | {last_kmr} | {last_kre} | {last_gfr} | [Ac]({rel_report}) |"
            )

        lines.append("")
        lines.append("> Not: Grafik PNG dosyalari `Doc/reports/assets/` altinda uretilir.")
        lines.append("")
        self.index_path.write_text("\n".join(lines), encoding="utf-8")

    def generate(self) -> Dict[str, Any]:
        """Generate all markdown reports and image assets from exported JSON artifacts."""
        self.reports_patients_dir.mkdir(parents=True, exist_ok=True)
        self.reports_assets_dir.mkdir(parents=True, exist_ok=True)

        patient_json_dir = self.public_dir / "patients"
        patient_files = sorted(patient_json_dir.glob("*.json"))

        reference_band = self._load_json(self.public_dir / "reference_band.json")
        data_summary = self._load_json(self.public_dir / "data_summary.json")
        patient_features = self._load_json(self.public_dir / "patient_features.json")
        doctor_report = self._load_json(self.public_dir / "doctor_performance_report.json")
        system_config = self._load_json(self.public_dir / "system_config.json")

        feature_rows = patient_features.get("patients", [])
        feature_map = {
            str(item.get("patient_code")): item
            for item in feature_rows
            if isinstance(item, dict) and item.get("patient_code") is not None
        }
        doctor_rows = doctor_report.get("patients", [])
        doctor_map = {
            str(item.get("patient_code")): item
            for item in doctor_rows
            if isinstance(item, dict) and item.get("patient_code") is not None
        }

        ref_lookup = self._build_reference_lookup(reference_band)
        alarm_thresholds = system_config.get("alarm_thresholds", {}) if isinstance(system_config, dict) else {}

        patient_artifacts: List[PatientArtifacts] = []
        for patient_file in patient_files:
            patient_payload = self._load_json(patient_file)
            meta = patient_payload.get("meta", {}) if isinstance(patient_payload, dict) else {}
            code = str(meta.get("patient_code") or patient_file.stem)
            timeline = patient_payload.get("timeline", []) if isinstance(patient_payload, dict) else []
            timeline = sorted(
                [point for point in timeline if isinstance(point, dict)],
                key=lambda point: int(point.get("time_order")) if point.get("time_order") is not None else 999,
            )

            kmr_chart = self._render_kmr_chart(code, timeline, ref_lookup)
            lab_chart = self._render_lab_chart(code, timeline, ref_lookup)
            risk_chart = self._render_risk_chart(code, timeline, alarm_thresholds)

            report_path = self.reports_patients_dir / f"{code}.md"
            artifacts = PatientArtifacts(
                code=code,
                report_path=report_path,
                kmr_chart=kmr_chart,
                lab_chart=lab_chart,
                risk_chart=risk_chart,
            )
            self._write_patient_markdown(
                patient=patient_payload,
                timeline=timeline,
                feature=feature_map.get(code, {}),
                doctor_row=doctor_map.get(code, {}),
                artifacts=artifacts,
                ref_lookup=ref_lookup,
            )
            patient_artifacts.append(artifacts)

        created_at = (
            str(data_summary.get("metadata", {}).get("created_at"))
            if isinstance(data_summary, dict)
            else datetime.now().isoformat()
        )
        self._write_index_markdown(
            created_at=created_at,
            data_summary=data_summary,
            doctor_report=doctor_report,
            artifacts=patient_artifacts,
            feature_map=feature_map,
        )

        return {
            "index_markdown": str(self.index_path),
            "patient_reports": len(patient_artifacts),
            "assets": len(list(self.reports_assets_dir.glob("*.png"))),
        }
