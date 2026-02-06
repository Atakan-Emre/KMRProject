"""
Export JSON - Generate all JSON files for frontend
"""
import json
import math
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd
import numpy as np

from .config import FRONTEND_PUBLIC, PATIENTS_DIR


def sanitize_for_json(obj: Any) -> Any:
    """Recursively sanitize an object for JSON serialization (convert NaN/Inf to None)"""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    elif pd.isna(obj):
        return None
    else:
        return obj


def _safe_float(value: Any) -> Optional[float]:
    """Convert value to float when possible, otherwise return None."""
    if value is None:
        return None
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def _is_kmr_threshold_anomaly(kmr: Any) -> bool:
    val = _safe_float(kmr)
    return val is not None and (val > 5.0 or val < 0.0)


def _is_kre_threshold_anomaly(kre: Any) -> bool:
    val = _safe_float(kre)
    return val is not None and (val > 4.5 or val < 0.0)


def _is_gfr_threshold_anomaly(gfr: Any) -> bool:
    val = _safe_float(gfr)
    return val is not None and (val < 15.0 or val > 120.0)


def _timeline_anomaly_flags(timeline: List[dict]) -> Dict[str, bool]:
    """
    Build anomaly flags from both AI anomaly outputs and clinical threshold breaches.
    This keeps list-level anomaly badges aligned with what the user sees on charts.
    """
    kmr_ai = any(bool(t.get("kmr_anomaly_flag", False)) for t in timeline)
    kre_ai = any(bool(t.get("kre_anomaly_flag", False)) for t in timeline)
    gfr_ai = any(bool(t.get("gfr_anomaly_flag", False)) for t in timeline)

    kmr_threshold = any(_is_kmr_threshold_anomaly(t.get("kmr")) for t in timeline)
    kre_threshold = any(_is_kre_threshold_anomaly(t.get("kre")) for t in timeline)
    gfr_threshold = any(_is_gfr_threshold_anomaly(t.get("gfr")) for t in timeline)

    kmr_has = kmr_ai or kmr_threshold
    kre_has = kre_ai or kre_threshold
    gfr_has = gfr_ai or gfr_threshold

    return {
        "kmr_has_anomaly": kmr_has,
        "kre_has_anomaly": kre_has,
        "gfr_has_anomaly": gfr_has,
        "has_anomaly": kmr_has or kre_has or gfr_has,
    }


class JSONExporter:
    """Export data to JSON files for frontend consumption"""
    
    def __init__(self, output_dir: Path = None):
        self.output_dir = output_dir or FRONTEND_PUBLIC
        self.patients_dir = self.output_dir / "patients"
        
        # Ensure directories exist
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.patients_dir.mkdir(parents=True, exist_ok=True)
    
    def export_patient_json(self, patient_code: str, meta: dict, 
                           timeline: List[dict], last_status: dict) -> None:
        """Export single patient JSON file"""
        patient_data = {
            "meta": meta,
            "timeline": timeline,
            "last_status": last_status
        }
        
        filepath = self.patients_dir / f"{patient_code}.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(sanitize_for_json(patient_data), f, ensure_ascii=False, indent=2)
    
    def export_reference_band(self, band_data: dict) -> None:
        """Export reference band JSON"""
        filepath = self.output_dir / "reference_band.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(sanitize_for_json(band_data), f, ensure_ascii=False, indent=2)
        print(f"✅ Exported: {filepath}")
    
    def export_cohort_trajectory(self, trajectory_data: dict) -> None:
        """Export improved cohort trajectory JSON (LSTM/VAE based)"""
        filepath = self.output_dir / "cohort_trajectory.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(sanitize_for_json(trajectory_data), f, ensure_ascii=False, indent=2)
        print(f"✅ Exported: {filepath}")
    
    def export_data_summary(self, meta_df: pd.DataFrame, 
                           patient_risks: Dict[str, dict]) -> None:
        """Export data summary JSON with dashboard KPIs"""
        total_patients = len(meta_df)
        improved_count = meta_df["improved_proxy"].sum()
        
        # Risk distribution
        risk_levels = {"Normal": 0, "Dikkat": 0, "Kritik": 0, "Çok Kritik": 0}
        anomaly_count = 0
        risk_scores = []
        last_kmr_values = []
        last_kre_values = []
        last_gfr_values = []
        
        for patient, data in patient_risks.items():
            level = data.get("risk_level_last", "Normal")
            if level in risk_levels:
                risk_levels[level] += 1
            
            if data.get("has_anomaly", False):
                anomaly_count += 1
            
            risk_scores.append(data.get("risk_last", 0))
            
            if data.get("kmr_last") is not None:
                last_kmr_values.append(data["kmr_last"])
            if data.get("kre_last") is not None:
                last_kre_values.append(data["kre_last"])
            if data.get("gfr_last") is not None:
                last_gfr_values.append(data["gfr_last"])
        
        summary = {
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "schema_version": "3.0"
            },
            "totals": {
                "n_patients": total_patients,
                "improved_proxy_count": int(improved_count),
                "patients_with_anomalies": anomaly_count
            },
            "risk_distribution": risk_levels,
            "averages": {
                "risk_score": round(np.mean(risk_scores), 1) if risk_scores else 0,
                "kmr_last": round(np.mean(last_kmr_values), 4) if last_kmr_values else None,
                "kre_last": round(np.mean(last_kre_values), 2) if last_kre_values else None,
                "gfr_last": round(np.mean(last_gfr_values), 1) if last_gfr_values else None
            }
        }
        
        filepath = self.output_dir / "data_summary.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(sanitize_for_json(summary), f, ensure_ascii=False, indent=2)
        print(f"✅ Exported: {filepath}")
    
    def export_patient_features(self, meta_df: pd.DataFrame,
                                patient_risks: Dict[str, dict],
                                kmr_long: pd.DataFrame,
                                lab_long: pd.DataFrame,
                                timelines: Dict[str, List[dict]] = None) -> None:
        """Export patient features JSON for dashboard list"""
        features = []
        timelines = timelines or {}
        
        for _, row in meta_df.iterrows():
            patient = row["patient_code"]
            risk_data = patient_risks.get(patient, {})
            timeline = timelines.get(patient, [])
            
            # Get KMR data
            p_kmr = kmr_long[kmr_long["patient_code"] == patient].sort_values("time_order")
            kmr_values = p_kmr["kmr"].tolist() if len(p_kmr) > 0 else []
            
            # Get LAB data
            p_lab = lab_long[lab_long["patient_code"] == patient].sort_values("time_order")
            # None + NaN değerleri güvenli şekilde ele (NaN, "is not None" filtresinden geçebilir)
            kre_values = [float(v) for v in p_lab["kre"].tolist() if pd.notna(v)] if len(p_lab) > 0 else []
            gfr_values = [float(v) for v in p_lab["gfr"].tolist() if pd.notna(v)] if len(p_lab) > 0 else []
            
            # Calculate slopes
            kmr_slope = None
            if len(kmr_values) >= 3:
                x = np.arange(len(kmr_values))
                kmr_slope = round(float(np.polyfit(x, kmr_values, 1)[0]), 4)
            
            kre_slope = None
            if len(kre_values) >= 3:
                x = np.arange(len(kre_values))
                kre_slope = round(float(np.polyfit(x, kre_values, 1)[0]), 4)
            
            gfr_slope = None
            if len(gfr_values) >= 3:
                x = np.arange(len(gfr_values))
                gfr_slope = round(float(np.polyfit(x, gfr_values, 1)[0]), 4)
            
            # Variability (CV)
            kmr_cv = round(float(np.std(kmr_values) / (np.mean(kmr_values) + 1e-6)), 4) if len(kmr_values) > 1 else None
            
            # Get last values and time keys directly from DataFrames (more reliable)
            # KMR - son gerçek değeri bul
            last_kmr = None
            last_kmr_time_key = None
            last_kmr_time_order = None
            if len(p_kmr) > 0:
                # Son KMR kaydını al (time_order'a göre sıralanmış)
                last_kmr_row = p_kmr.iloc[-1]
                last_kmr = float(last_kmr_row["kmr"]) if pd.notna(last_kmr_row["kmr"]) else None
                last_kmr_time_key = str(last_kmr_row["time_key"]) if pd.notna(last_kmr_row["time_key"]) else None
                last_kmr_time_order = int(last_kmr_row["time_order"]) if pd.notna(last_kmr_row["time_order"]) else None
            
            # Eğer risk_data'da varsa onu kullan (daha güncel olabilir)
            if risk_data.get("kmr_last") is not None:
                last_kmr = risk_data.get("kmr_last")
            if risk_data.get("last_kmr_order") is not None:
                last_kmr_time_order = risk_data.get("last_kmr_order")
                # time_order'dan time_key bul
                if last_kmr_time_order is not None and len(p_kmr) > 0:
                    kmr_with_order = p_kmr[p_kmr["time_order"] == last_kmr_time_order]
                    if len(kmr_with_order) > 0:
                        found_time_key = str(kmr_with_order.iloc[0]["time_key"]) if pd.notna(kmr_with_order.iloc[0]["time_key"]) else None
                        if found_time_key:
                            last_kmr_time_key = found_time_key
            
            # KRE - son gerçek değeri bul
            last_kre = None
            last_kre_time_key = None
            last_kre_time_order = None
            if len(p_lab) > 0:
                kre_rows = p_lab[p_lab["kre"].notna()]
                if len(kre_rows) > 0:
                    last_kre_row = kre_rows.iloc[-1]
                    last_kre = float(last_kre_row["kre"]) if pd.notna(last_kre_row["kre"]) else None
                    last_kre_time_key = str(last_kre_row["time_key"]) if pd.notna(last_kre_row["time_key"]) else None
                    last_kre_time_order = int(last_kre_row["time_order"]) if pd.notna(last_kre_row["time_order"]) else None
            
            # Eğer risk_data'da varsa onu kullan
            if risk_data.get("kre_last") is not None:
                last_kre = risk_data.get("kre_last")
            if risk_data.get("last_kre_order") is not None:
                last_kre_time_order = risk_data.get("last_kre_order")
                # time_order'dan time_key bul
                if last_kre_time_order is not None and len(p_lab) > 0:
                    kre_with_order = p_lab[(p_lab["time_order"] == last_kre_time_order) & (p_lab["kre"].notna())]
                    if len(kre_with_order) > 0:
                        found_time_key = str(kre_with_order.iloc[0]["time_key"]) if pd.notna(kre_with_order.iloc[0]["time_key"]) else None
                        if found_time_key:
                            last_kre_time_key = found_time_key
            
            # GFR - son gerçek değeri bul
            last_gfr = None
            last_gfr_time_key = None
            last_gfr_time_order = None
            if len(p_lab) > 0:
                gfr_rows = p_lab[p_lab["gfr"].notna()]
                if len(gfr_rows) > 0:
                    last_gfr_row = gfr_rows.iloc[-1]
                    last_gfr = float(last_gfr_row["gfr"]) if pd.notna(last_gfr_row["gfr"]) else None
                    last_gfr_time_key = str(last_gfr_row["time_key"]) if pd.notna(last_gfr_row["time_key"]) else None
                    last_gfr_time_order = int(last_gfr_row["time_order"]) if pd.notna(last_gfr_row["time_order"]) else None
            
            # Eğer risk_data'da varsa onu kullan
            if risk_data.get("gfr_last") is not None:
                last_gfr = risk_data.get("gfr_last")
            if risk_data.get("last_gfr_order") is not None:
                last_gfr_time_order = risk_data.get("last_gfr_order")
                # time_order'dan time_key bul
                if last_gfr_time_order is not None and len(p_lab) > 0:
                    gfr_with_order = p_lab[(p_lab["time_order"] == last_gfr_time_order) & (p_lab["gfr"].notna())]
                    if len(gfr_with_order) > 0:
                        found_time_key = str(gfr_with_order.iloc[0]["time_key"]) if pd.notna(gfr_with_order.iloc[0]["time_key"]) else None
                        if found_time_key:
                            last_gfr_time_key = found_time_key

            anomaly_flags = _timeline_anomaly_flags(timeline)
            
            features.append({
                "patient_code": patient,
                "age": int(row["age"]) if pd.notna(row["age"]) else None,
                "gender": row["gender"] if pd.notna(row["gender"]) else None,
                "vital_status": row["vital_status"] if pd.notna(row["vital_status"]) else None,
                "improved_proxy": bool(row["improved_proxy"]),
                
                "n_kmr_points": len(kmr_values),
                "n_kre_points": len(kre_values),
                "n_gfr_points": len(gfr_values),
                
                "last_kmr": last_kmr,
                "last_kre": last_kre,
                "last_gfr": last_gfr,
                
                "last_kmr_time_key": last_kmr_time_key,
                "last_kre_time_key": last_kre_time_key,
                "last_gfr_time_key": last_gfr_time_key,
                "last_kmr_time_order": int(last_kmr_time_order) if last_kmr_time_order is not None else None,
                "last_kre_time_order": int(last_kre_time_order) if last_kre_time_order is not None else None,
                "last_gfr_time_order": int(last_gfr_time_order) if last_gfr_time_order is not None else None,
                
                "kmr_slope": kmr_slope,
                "kre_slope": kre_slope,
                "gfr_slope": gfr_slope,
                "kmr_variability": kmr_cv,
                
                "risk_score": risk_data.get("risk_last", 0),
                "risk_level": risk_data.get("risk_level_last", "Normal"),
                "has_anomaly": bool(risk_data.get("has_anomaly", anomaly_flags["has_anomaly"])),
                # Anomali bayrakları - AI + klinik eşik ihlali birleşik
                "kmr_has_anomaly": bool(risk_data.get("kmr_has_anomaly", anomaly_flags["kmr_has_anomaly"])),
                "kre_has_anomaly": bool(risk_data.get("kre_has_anomaly", anomaly_flags["kre_has_anomaly"])),
                "gfr_has_anomaly": bool(risk_data.get("gfr_has_anomaly", anomaly_flags["gfr_has_anomaly"]))
            })
        
        filepath = self.output_dir / "patient_features.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(sanitize_for_json({"patients": features}), f, ensure_ascii=False, indent=2)
        print(f"✅ Exported: {filepath}")
    
    def export_channel_overview(self, kmr_long: pd.DataFrame, 
                                lab_long: pd.DataFrame) -> None:
        """Export channel/metrics overview JSON"""
        # Get unique time keys with data
        kmr_time_keys = kmr_long["time_key"].unique().tolist()
        lab_time_keys = lab_long["time_key"].unique().tolist()
        
        overview = {
            "metadata": {
                "created_at": datetime.now().isoformat()
            },
            "metrics": ["kmr", "kre", "gfr"],
            "coverage": {
                "kmr": {
                    "time_keys": sorted(kmr_time_keys, key=lambda x: self._get_order(x)),
                    "n_measurements": len(kmr_long)
                },
                "kre": {
                    "time_keys": sorted([f"{tk}_KRE" for tk in lab_time_keys], 
                                       key=lambda x: self._get_order(x)),
                    "n_measurements": int(lab_long["kre"].notna().sum())
                },
                "gfr": {
                    "time_keys": sorted([f"{tk}_GFR" for tk in lab_time_keys],
                                       key=lambda x: self._get_order(x)),
                    "n_measurements": int(lab_long["gfr"].notna().sum())
                }
            }
        }
        
        filepath = self.output_dir / "channel_overview.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(sanitize_for_json(overview), f, ensure_ascii=False, indent=2)
        print(f"✅ Exported: {filepath}")
    
    def _get_order(self, time_key: str) -> int:
        """Get order for sorting time keys"""
        from .time_mapping import UNIFIED_TIME_MAP
        base_key = time_key.replace("_KRE", "").replace("_GFR", "")
        return UNIFIED_TIME_MAP.get(base_key, {}).get("order", 999)

    def _compute_metric_performance(
        self,
        timeline: List[dict],
        *,
        actual_key: str,
        pred_key: str,
        pred_lo_key: str,
        pred_hi_key: str,
        pred_status_key: str,
        mape_floor: float,
        round_digits: int,
    ) -> Dict[str, Any]:
        """
        Compute per-metric prediction performance for one patient.
        Evaluation is done where actual and prediction are both available and prediction status is 'ok'
        (or status is missing for backward compatibility).
        """
        n_actual = 0
        n_pred = 0
        n_eval = 0
        n_interval = 0
        interval_hits = 0
        abs_errors: List[float] = []
        sq_errors: List[float] = []
        apes: List[float] = []
        signed_errors: List[float] = []

        last_actual = None
        last_pred = None
        last_error = None

        for point in timeline:
            actual = _safe_float(point.get(actual_key))
            pred = _safe_float(point.get(pred_key))
            pred_lo = _safe_float(point.get(pred_lo_key))
            pred_hi = _safe_float(point.get(pred_hi_key))
            pred_status = str(point.get(pred_status_key) or "")

            if actual is not None:
                n_actual += 1
                last_actual = actual

            if pred is not None:
                n_pred += 1
                last_pred = pred

            status_ok = pred_status in {"", "ok"}
            if actual is None or pred is None or not status_ok:
                continue

            err = pred - actual
            abs_err = abs(err)
            denom = max(abs(actual), mape_floor)

            abs_errors.append(abs_err)
            sq_errors.append(err * err)
            apes.append(abs_err / denom)
            signed_errors.append(err)
            n_eval += 1
            last_error = err

            if pred_lo is not None and pred_hi is not None:
                n_interval += 1
                if pred_lo <= actual <= pred_hi:
                    interval_hits += 1

        mae = round(float(np.mean(abs_errors)), round_digits) if abs_errors else None
        rmse = round(float(np.sqrt(np.mean(sq_errors))), round_digits) if sq_errors else None
        mape = round(float(np.mean(apes) * 100.0), 2) if apes else None
        bias = round(float(np.mean(signed_errors)), round_digits) if signed_errors else None
        coverage = round(float(interval_hits / n_interval), 4) if n_interval > 0 else None

        return {
            "n_actual_points": n_actual,
            "n_pred_points": n_pred,
            "n_eval_points": n_eval,
            "mae": mae,
            "rmse": rmse,
            "mape_percent": mape,
            "bias": bias,
            "n_interval_points": n_interval,
            "interval_coverage": coverage,
            "last_actual": round(last_actual, round_digits) if last_actual is not None else None,
            "last_pred": round(last_pred, round_digits) if last_pred is not None else None,
            "last_error": round(last_error, round_digits) if last_error is not None else None,
            "_agg_abs_error": float(np.sum(abs_errors)) if abs_errors else 0.0,
            "_agg_sq_error": float(np.sum(sq_errors)) if sq_errors else 0.0,
            "_agg_ape": float(np.sum(apes)) if apes else 0.0,
            "_agg_n_eval": n_eval,
            "_agg_n_interval": n_interval,
            "_agg_interval_hits": interval_hits,
        }

    def _build_report_summary(self, patient_rows: List[dict]) -> Dict[str, Any]:
        """Build aggregate summary from patient-level report rows."""
        metric_names = ["kmr", "kre", "gfr"]
        summary_metrics: Dict[str, Dict[str, Any]] = {}

        for metric in metric_names:
            patients_with_eval = 0
            total_eval_points = 0
            total_interval_points = 0
            total_interval_hits = 0
            agg_abs_error = 0.0
            agg_sq_error = 0.0
            agg_ape = 0.0

            for row in patient_rows:
                info = row.get(metric, {})
                n_eval = int(info.get("_agg_n_eval", 0) or 0)
                if n_eval > 0:
                    patients_with_eval += 1
                total_eval_points += n_eval
                total_interval_points += int(info.get("_agg_n_interval", 0) or 0)
                total_interval_hits += int(info.get("_agg_interval_hits", 0) or 0)
                agg_abs_error += float(info.get("_agg_abs_error", 0.0) or 0.0)
                agg_sq_error += float(info.get("_agg_sq_error", 0.0) or 0.0)
                agg_ape += float(info.get("_agg_ape", 0.0) or 0.0)

            summary_metrics[metric] = {
                "patients_with_eval": patients_with_eval,
                "total_eval_points": total_eval_points,
                "mae": round(agg_abs_error / total_eval_points, 4) if total_eval_points > 0 else None,
                "rmse": round(float(np.sqrt(agg_sq_error / total_eval_points)), 4) if total_eval_points > 0 else None,
                "mape_percent": round((agg_ape / total_eval_points) * 100.0, 2) if total_eval_points > 0 else None,
                "interval_coverage": round(total_interval_hits / total_interval_points, 4) if total_interval_points > 0 else None,
            }

        patients_with_any_eval = 0
        for row in patient_rows:
            if any(int((row.get(metric, {}) or {}).get("n_eval_points", 0) or 0) > 0 for metric in metric_names):
                patients_with_any_eval += 1

        return {
            "n_patients": len(patient_rows),
            "patients_with_any_eval": patients_with_any_eval,
            "metrics": summary_metrics,
        }

    def export_doctor_performance_report(
        self,
        meta_df: pd.DataFrame,
        patient_risks: Dict[str, dict],
        timelines: Dict[str, List[dict]],
    ) -> None:
        """
        Export patient-based doctor performance report.
        Includes KMR/KRE/GFR prediction quality metrics per patient.
        """
        rows: List[dict] = []

        for _, row in meta_df.iterrows():
            patient = str(row["patient_code"])
            timeline = timelines.get(patient, [])
            risk_data = patient_risks.get(patient, {})

            kmr_perf = self._compute_metric_performance(
                timeline,
                actual_key="kmr",
                pred_key="kmr_pred",
                pred_lo_key="kmr_pred_lo",
                pred_hi_key="kmr_pred_hi",
                pred_status_key="kmr_pred_status",
                mape_floor=0.05,
                round_digits=4,
            )
            kre_perf = self._compute_metric_performance(
                timeline,
                actual_key="kre",
                pred_key="kre_pred",
                pred_lo_key="kre_pred_lo",
                pred_hi_key="kre_pred_hi",
                pred_status_key="kre_pred_status",
                mape_floor=0.1,
                round_digits=3,
            )
            gfr_perf = self._compute_metric_performance(
                timeline,
                actual_key="gfr",
                pred_key="gfr_pred",
                pred_lo_key="gfr_pred_lo",
                pred_hi_key="gfr_pred_hi",
                pred_status_key="gfr_pred_status",
                mape_floor=1.0,
                round_digits=2,
            )

            rows.append(
                {
                    "patient_code": patient,
                    "improved_proxy": bool(row.get("improved_proxy", False)),
                    "risk_level": risk_data.get("risk_level_last", "Normal"),
                    "risk_score": round(float(risk_data.get("risk_last", 0.0)), 2),
                    "has_anomaly": bool(risk_data.get("has_anomaly", False)),
                    "kmr_has_anomaly": bool(risk_data.get("kmr_has_anomaly", False)),
                    "kre_has_anomaly": bool(risk_data.get("kre_has_anomaly", False)),
                    "gfr_has_anomaly": bool(risk_data.get("gfr_has_anomaly", False)),
                    "kmr": kmr_perf,
                    "kre": kre_perf,
                    "gfr": gfr_perf,
                }
            )

        summary = self._build_report_summary(rows)

        cleaned_rows: List[dict] = []
        agg_keys = {
            "_agg_abs_error",
            "_agg_sq_error",
            "_agg_ape",
            "_agg_n_eval",
            "_agg_n_interval",
            "_agg_interval_hits",
        }
        for item in rows:
            cleaned = dict(item)
            for metric in ("kmr", "kre", "gfr"):
                metric_obj = dict(cleaned.get(metric, {}))
                for agg_key in agg_keys:
                    metric_obj.pop(agg_key, None)
                cleaned[metric] = metric_obj
            cleaned_rows.append(cleaned)

        json_payload = {
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "schema_version": "1.0",
                "type": "doctor_performance_patient_based",
            },
            "summary": summary,
            "patients": cleaned_rows,
        }

        json_path = self.output_dir / "doctor_performance_report.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(sanitize_for_json(json_payload), f, ensure_ascii=False, indent=2)
        print(f"✅ Exported: {json_path}")

        # Flatten for CSV export (doctor-friendly tabular format)
        csv_rows = []
        for item in cleaned_rows:
            csv_rows.append(
                {
                    "patient_code": item["patient_code"],
                    "improved_proxy": item["improved_proxy"],
                    "risk_level": item["risk_level"],
                    "risk_score": item["risk_score"],
                    "has_anomaly": item["has_anomaly"],
                    "kmr_has_anomaly": item["kmr_has_anomaly"],
                    "kre_has_anomaly": item["kre_has_anomaly"],
                    "gfr_has_anomaly": item["gfr_has_anomaly"],
                    "kmr_n_eval": item["kmr"]["n_eval_points"],
                    "kmr_mae": item["kmr"]["mae"],
                    "kmr_rmse": item["kmr"]["rmse"],
                    "kmr_mape_percent": item["kmr"]["mape_percent"],
                    "kmr_interval_coverage": item["kmr"]["interval_coverage"],
                    "kre_n_eval": item["kre"]["n_eval_points"],
                    "kre_mae": item["kre"]["mae"],
                    "kre_rmse": item["kre"]["rmse"],
                    "kre_mape_percent": item["kre"]["mape_percent"],
                    "kre_interval_coverage": item["kre"]["interval_coverage"],
                    "gfr_n_eval": item["gfr"]["n_eval_points"],
                    "gfr_mae": item["gfr"]["mae"],
                    "gfr_rmse": item["gfr"]["rmse"],
                    "gfr_mape_percent": item["gfr"]["mape_percent"],
                    "gfr_interval_coverage": item["gfr"]["interval_coverage"],
                }
            )

        csv_path = self.output_dir / "doctor_performance_report.csv"
        pd.DataFrame(csv_rows).to_csv(csv_path, index=False, encoding="utf-8-sig")
        print(f"✅ Exported: {csv_path}")
    
    def bulk_export_patients(self, meta_df: pd.DataFrame,
                             kmr_long: pd.DataFrame,
                             lab_long: pd.DataFrame,
                             timelines: Dict[str, List[dict]]) -> Dict[str, dict]:
        """Export all patient JSON files and return last status for each"""
        patient_risks = {}
        
        print(f"📁 Exporting {len(meta_df)} patient JSON files...")
        
        for _, row in meta_df.iterrows():
            patient = row["patient_code"]
            timeline = timelines.get(patient, [])
            
            # Build meta
            p_kmr = kmr_long[kmr_long["patient_code"] == patient]
            p_lab = lab_long[lab_long["patient_code"] == patient]
            
            # Safe value extraction
            def safe_float(val):
                if pd.isna(val):
                    return None
                try:
                    return float(val)
                except (TypeError, ValueError):
                    return None
            
            def safe_int(val):
                if pd.isna(val):
                    return None
                try:
                    return int(val)
                except (TypeError, ValueError):
                    return None
            
            def safe_str(val):
                if pd.isna(val):
                    return None
                return str(val)
            
            meta = {
                "patient_code": patient,
                "age": safe_int(row["age"]),
                "BMI": safe_float(row["BMI"]),
                "gender": safe_str(row["gender"]),
                "vital_status": safe_str(row["vital_status"]),
                "blood_group": safe_str(row["blood_group"]),
                "improved_proxy": bool(row["improved_proxy"]),
                "n_kmr_points": len(p_kmr),
                "n_kre_points": int(p_lab["kre"].notna().sum()) if len(p_lab) > 0 else 0,
                "n_gfr_points": int(p_lab["gfr"].notna().sum()) if len(p_lab) > 0 else 0
            }
            
            # Build last status - max risk point veya son dolu ölçüm
            last_status = {
                "last_time_key": None,
                "last_time_order": None,
                "kmr_last": None,
                "kre_last": None,
                "gfr_last": None,
                "last_kmr_order": None,  # Son gerçek KMR noktasının time_order'ı
                "last_kre_order": None,  # Son gerçek KRE noktasının time_order'ı
                "last_gfr_order": None,  # Son gerçek GFR noktasının time_order'ı
                "risk_last": 0,
                "risk_level_last": "Normal"
            }
            
            if timeline:
                # Find max risk point (en yüksek risk_score olan nokta) - sadece risk için
                max_risk_point = None
                max_risk_score = -1
                for t in timeline:
                    risk_score = t.get("risk_score")
                    if risk_score is not None and risk_score > max_risk_score:
                        max_risk_score = risk_score
                        max_risk_point = t
                
                # Risk skoru ve seviyesi için max risk point'i kullan
                if max_risk_score >= 0:
                    last_status["risk_last"] = max_risk_score
                    from .risk_scoring import RiskScorer
                    scorer = RiskScorer()
                    last_status["risk_level_last"] = scorer.determine_alarm_level(max_risk_score)
                    if max_risk_point:
                        last_status["last_time_key"] = max_risk_point.get("time_key")
                        last_status["last_time_order"] = max_risk_point.get("time_order")
                
                # Her metrik için SON GERÇEK değeri ayrı ayrı bul (timeline'dan geriye doğru)
                # KMR - son gerçek değer
                for t in reversed(timeline):
                    kmr_val = t.get("kmr")
                    if kmr_val is not None:
                        last_status["kmr_last"] = kmr_val
                        last_status["last_kmr_order"] = t.get("time_order")
                        # Eğer last_time_key yoksa, son KMR'nin time_key'ini kullan
                        if last_status["last_time_key"] is None:
                            last_status["last_time_key"] = t.get("time_key")
                            last_status["last_time_order"] = t.get("time_order")
                        break
                
                # KRE - son gerçek değer
                for t in reversed(timeline):
                    kre_val = t.get("kre")
                    if kre_val is not None:
                        last_status["kre_last"] = kre_val
                        last_status["last_kre_order"] = t.get("time_order")
                        break
                
                # GFR - son gerçek değer
                for t in reversed(timeline):
                    gfr_val = t.get("gfr")
                    if gfr_val is not None:
                        last_status["gfr_last"] = gfr_val
                        last_status["last_gfr_order"] = t.get("time_order")
                        break
            
            # Check for anomalies - AI flags + klinik eşik ihlalleri
            anomaly_flags = _timeline_anomaly_flags(timeline)
            
            # Export
            self.export_patient_json(patient, meta, timeline, last_status)
            
            # Store for summary
            patient_risks[patient] = {
                **last_status,
                **anomaly_flags
            }
        
        print(f"✅ All patient files exported to {self.patients_dir}")
        return patient_risks


if __name__ == "__main__":
    print("Export module loaded. Use run_all.py to execute full pipeline.")
