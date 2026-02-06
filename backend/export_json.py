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
