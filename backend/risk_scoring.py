"""
Risk Scoring - Ensemble risk calculation with KMR + LAB components
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from scipy import stats

from .config import RISK_WEIGHTS, CLINICAL_THRESHOLDS, ALARM_THRESHOLDS


class RiskScorer:
    """Calculate risk scores from KMR predictions and LAB values"""
    
    def __init__(self, weights: dict = None, thresholds: dict = None):
        self.weights = weights or RISK_WEIGHTS
        self.clinical = thresholds or CLINICAL_THRESHOLDS
        self.alarm = ALARM_THRESHOLDS
    
    # ==================== KMR COMPONENTS ====================
    
    def calc_kmr_level_score(self, kmr: float, pseudo_time_days: Optional[int] = None) -> float:
        """
        KMR level score (0-100)
        Based on clinical thresholds
        """
        thresholds = self.clinical["kmr"]
        
        if kmr <= thresholds["normal_upper"]:
            # 0-0.5: very good (0-20)
            base = (kmr / thresholds["normal_upper"]) * 20
        elif kmr <= thresholds["dikkat_upper"]:
            # 0.5-2: attention (20-50)
            base = 20 + ((kmr - thresholds["normal_upper"]) /
                         (thresholds["dikkat_upper"] - thresholds["normal_upper"])) * 30
        elif kmr <= thresholds["kritik_upper"]:
            # 2-5: critical (50-80)
            base = 50 + ((kmr - thresholds["dikkat_upper"]) /
                         (thresholds["kritik_upper"] - thresholds["dikkat_upper"])) * 30
        else:
            # >5: very critical (80-100)
            excess = kmr - thresholds["kritik_upper"]
            base = min(100, 80 + excess * 4)

        # Clinical phase-aware weighting:
        # first 48h values can be transiently high and should be penalized less.
        if pseudo_time_days is None:
            return base
        if pseudo_time_days <= 2:
            return base * 0.55
        if pseudo_time_days <= 6:
            return base * 0.80
        return base
    
    def calc_kmr_trend_score(self, slopes: List[float], consecutive_up: int) -> float:
        """
        KMR trend score (0-100)
        Positive slope after early phase is bad
        """
        if not slopes:
            return 0
        
        avg_slope = np.mean(slopes[-3:]) if len(slopes) >= 3 else np.mean(slopes)
        
        # Positive slope is bad (score increases)
        if avg_slope > 0:
            slope_score = min(50, avg_slope * 20)
        else:
            slope_score = max(0, 10 + avg_slope * 5)  # Negative slope is good
        
        # Consecutive increases add to score
        consec_score = min(30, consecutive_up * 10)
        
        return min(100, slope_score + consec_score)
    
    def calc_kmr_volatility_score(self, cv: float) -> float:
        """
        KMR volatility score (0-100)
        High CV is concerning
        """
        # CV > 0.5 is very high volatility
        return min(100, cv * 100)
    
    def calc_kmr_ae_score(self, anomaly_score: float) -> float:
        """KMR autoencoder anomaly score (already 0-100)"""
        return min(100, anomaly_score)
    
    def calc_kmr_residual_score(self, residual: float, kmr_mean: float) -> float:
        """
        KMR residual score (0-100)
        Large prediction errors indicate unusual behavior
        """
        if residual is None:
            return 0.0
        if kmr_mean < 0.01:
            return 0
        
        relative_error = abs(residual) / (kmr_mean + 0.01)
        return min(100, relative_error * 50)
    
    def calc_kmr_risk(self, level: float, trend: float, volatility: float, 
                      ae: float, residual: float) -> float:
        """Calculate combined KMR risk score"""
        w = self.weights
        return (w["kmr_level"] * level +
                w["kmr_trend"] * trend +
                w["kmr_volatility"] * volatility +
                w["kmr_ae"] * ae +
                w["kmr_residual"] * residual)
    
    # ==================== LAB COMPONENTS ====================
    
    def calc_kre_level_score(self, kre: Optional[float]) -> Optional[float]:
        """
        KRE level score (0-100)
        Lower is better: <1.2 very good, >4.5 very bad
        """
        if kre is None:
            return None
        
        thresholds = self.clinical["kre"]
        
        if kre <= thresholds["very_good_lt"]:
            # <1.2: excellent (0-10)
            return (kre / thresholds["very_good_lt"]) * 10
        elif kre <= thresholds["very_bad_gt"]:
            # 1.2-4.5: linear scale (10-90)
            return 10 + ((kre - thresholds["very_good_lt"]) / 
                        (thresholds["very_bad_gt"] - thresholds["very_good_lt"])) * 80
        else:
            # >4.5: very bad (90-100)
            return min(100, 90 + (kre - thresholds["very_bad_gt"]) * 2)
    
    def calc_gfr_level_score(self, gfr: Optional[float]) -> Optional[float]:
        """
        GFR level score (0-100)
        Higher is better: >=90 very good, <=15 very bad
        """
        if gfr is None:
            return None
        
        thresholds = self.clinical["gfr"]
        
        if gfr >= thresholds["very_good_ge"]:
            # >=90: excellent (0-10)
            return max(0, 10 - (gfr - thresholds["very_good_ge"]) * 0.1)
        elif gfr >= thresholds["very_bad_le"]:
            # 15-90: linear scale (10-90)
            return 90 - ((gfr - thresholds["very_bad_le"]) / 
                        (thresholds["very_good_ge"] - thresholds["very_bad_le"])) * 80
        else:
            # <=15: very bad (90-100)
            return min(100, 90 + (thresholds["very_bad_le"] - gfr) * 0.5)
    
    def calc_lab_trend_score(self, kre_values: List[float], gfr_values: List[float]) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """
        Calculate LAB trend scores
        KRE: negative slope is good (decreasing)
        GFR: positive slope is good (increasing)
        
        Returns: (kre_trend_score, gfr_trend_score, combined_lab_trend)
        """
        kre_trend = None
        gfr_trend = None
        
        # KRE trend
        if len(kre_values) >= 3:
            valid_kre = [v for v in kre_values if v is not None]
            if len(valid_kre) >= 3:
                x = np.arange(len(valid_kre))
                slope = stats.theilslopes(valid_kre, x)[0]
                # Positive slope (increasing KRE) is bad
                if slope > 0:
                    kre_trend = min(100, slope * 50)
                else:
                    kre_trend = max(0, 20 + slope * 20)  # Negative is good
        
        # GFR trend
        if len(gfr_values) >= 3:
            valid_gfr = [v for v in gfr_values if v is not None]
            if len(valid_gfr) >= 3:
                x = np.arange(len(valid_gfr))
                slope = stats.theilslopes(valid_gfr, x)[0]
                # Negative slope (decreasing GFR) is bad
                if slope < 0:
                    gfr_trend = min(100, abs(slope) * 2)
                else:
                    gfr_trend = max(0, 20 - slope * 0.5)  # Positive is good
        
        # Combined
        combined = None
        if kre_trend is not None and gfr_trend is not None:
            combined = 0.5 * kre_trend + 0.5 * gfr_trend
        elif kre_trend is not None:
            combined = kre_trend
        elif gfr_trend is not None:
            combined = gfr_trend
        
        return kre_trend, gfr_trend, combined
    
    def calc_lab_risk(self, kre_level: Optional[float], gfr_level: Optional[float],
                      lab_trend: Optional[float], kre_anomaly_score: Optional[float] = None,
                      gfr_anomaly_score: Optional[float] = None) -> Optional[float]:
        """
        Calculate combined LAB risk score
        Includes anomaly scores from KRE/GFR VAE
        """
        components = []
        
        # Level component
        if kre_level is not None and gfr_level is not None:
            level_score = 0.5 * kre_level + 0.5 * gfr_level
            components.append(("level", level_score))
        elif kre_level is not None:
            components.append(("level", kre_level))
        elif gfr_level is not None:
            components.append(("level", gfr_level))
        
        # Trend component
        if lab_trend is not None:
            components.append(("trend", lab_trend))
        
        # Anomaly component - KRE/GFR anomaly scores contribute to LAB risk
        anomaly_score = None
        if kre_anomaly_score is not None and gfr_anomaly_score is not None:
            anomaly_score = 0.5 * kre_anomaly_score + 0.5 * gfr_anomaly_score
        elif kre_anomaly_score is not None:
            anomaly_score = kre_anomaly_score
        elif gfr_anomaly_score is not None:
            anomaly_score = gfr_anomaly_score
        
        if anomaly_score is not None and anomaly_score > 0:
            # Anomaly score contributes with 0.25 multiplier and cap at 50
            capped_anomaly = min(anomaly_score * 0.25, 50)
            components.append(("anomaly", capped_anomaly))
        
        if not components:
            return None
        
        w = self.weights
        level_w = w["lab_level_weight"]
        trend_w = w["lab_trend_weight"]
        anomaly_w = 0.3  # Anomaly weight
        
        total_weight = 0
        total_score = 0
        
        for name, score in components:
            if name == "level":
                total_score += level_w * score
                total_weight += level_w
            elif name == "trend":
                total_score += trend_w * score
                total_weight += trend_w
            elif name == "anomaly":
                total_score += anomaly_w * score
                total_weight += anomaly_w
        
        if total_weight > 0:
            # Normalize to 0-100 scale
            normalized_score = (total_score / total_weight) * (level_w + trend_w + anomaly_w)
            # Scale multiplier - dengeli ölçek (0.9)
            return min(100, normalized_score * 0.9)
        return None
    
    # ==================== OVERALL RISK ====================
    
    def calc_overall_risk(self, kmr_risk: float, lab_risk: Optional[float]) -> float:
        """
        Calculate overall risk score
        LAB risk'i KMR+20 ile cap'ler (LAB çok yüksekse bile KMR'den aşırı kopmasın)
        """
        w = self.weights
        
        if lab_risk is None:
            return kmr_risk
        
        # LAB risk'i KMR+20 ile cap'le (aşırı şişmeyi önle)
        capped_lab_risk = min(lab_risk, kmr_risk + 20) if lab_risk > kmr_risk + 20 else lab_risk
        
        return w["kmr_weight"] * kmr_risk + w["lab_weight"] * capped_lab_risk
    
    def determine_alarm_level(self, risk_score: float) -> str:
        """Determine alarm level from risk score"""
        if risk_score >= self.alarm["cok_kritik"]:
            return "Çok Kritik"
        elif risk_score >= self.alarm["kritik"]:
            return "Kritik"
        elif risk_score >= self.alarm["dikkat"]:
            return "Dikkat"
        return "Normal"
    
    # ==================== PATIENT SCORING ====================
    
    def score_patient_timeline(self, kmr_df: pd.DataFrame, lab_df: pd.DataFrame,
                               kmr_predictions: List[dict], kmr_anomaly_scores: List[dict],
                               lab_predictions: dict = None, lab_anomaly_scores: List[dict] = None) -> List[dict]:
        """
        Score each time point for a patient
        Creates UNIFIED timeline from ALL time points (KMR + LAB combined)
        
        Returns list of risk data per time point
        """
        from .time_mapping import UNIFIED_TIME_MAP
        
        # Build KMR lookup by time_key
        kmr_lookup = {}
        kmr_pred_lookup = {}  # Key: time_order, value: prediction dict
        kmr_anom_lookup = {}
        
        kmr_sorted = kmr_df.sort_values("time_order").reset_index(drop=True)
        for i, (_, row) in enumerate(kmr_sorted.iterrows()):
            tk = row["time_key"]
            order = row["time_order"]
            kmr_lookup[tk] = {
                "kmr": row["kmr"],
                "time_order": order,
                "pseudo_time_days": row["pseudo_time_days"]
            }
            if i < len(kmr_anomaly_scores):
                kmr_anom_lookup[tk] = kmr_anomaly_scores[i]
        
        # Map KMR predictions by time_order (unified grid format)
        # KMR predictions now include time_order and time_key
        if kmr_predictions:
            for pred in kmr_predictions:
                if isinstance(pred, dict):
                    # New format: {"time_order": X, "time_key": "...", "kmr_pred": ..., ...}
                    order = pred.get("time_order")
                    if order is not None:
                        kmr_pred_lookup[order] = pred
                    # Also support legacy format by time_key
                    tk = pred.get("time_key")
                    if tk is not None:
                        kmr_pred_lookup[tk] = pred
                else:
                    # Legacy format: index-based
                    if len(kmr_sorted) > 0 and len(kmr_predictions) == len(kmr_sorted):
                        for i, (_, row) in enumerate(kmr_sorted.iterrows()):
                            if i < len(kmr_predictions):
                                kmr_pred_lookup[row["time_order"]] = kmr_predictions[i]
                                kmr_pred_lookup[row["time_key"]] = kmr_predictions[i]
                    break
        
        # Build LAB lookup by time_key (with predictions and anomaly scores)
        lab_lookup = {}
        lab_pred_lookup = {}  # Key: base_time_key (e.g., "Day_7"), value: {"kre": {...}, "gfr": {...}}
        lab_anom_lookup = {}
        lab_sorted = lab_df.sort_values("time_order").reset_index(drop=True) if len(lab_df) > 0 else pd.DataFrame()
        
        # Process LAB predictions
        # LAB predictions are generated on unified grid (UNIFIED_TIME_MAP with has_lab=True)
        # We need to map them to unified time_keys by time_order
        if lab_predictions and len(lab_predictions) > 0:
            # Single metric format: {"kre": {"predictions": [...]}} or {"gfr": {"predictions": [...]}}
            # Multi-output format: {"kre_predictions": [...], "gfr_predictions": [...]}
            kre_preds = None
            gfr_preds = None
            
            # Try to extract predictions in different formats
            if "kre" in lab_predictions:
                if isinstance(lab_predictions["kre"], dict) and "predictions" in lab_predictions["kre"]:
                    kre_preds = lab_predictions["kre"]["predictions"]
                elif isinstance(lab_predictions["kre"], list):
                    kre_preds = lab_predictions["kre"]
            
            if "gfr" in lab_predictions:
                if isinstance(lab_predictions["gfr"], dict) and "predictions" in lab_predictions["gfr"]:
                    gfr_preds = lab_predictions["gfr"]["predictions"]
                elif isinstance(lab_predictions["gfr"], list):
                    gfr_preds = lab_predictions["gfr"]
            
            # Multi-output format
            if kre_preds is None and "kre_predictions" in lab_predictions:
                kre_preds = lab_predictions["kre_predictions"]
            if gfr_preds is None and "gfr_predictions" in lab_predictions:
                gfr_preds = lab_predictions["gfr_predictions"]
            
            # Map predictions to unified time keys by time_order
            # LAB predictions are generated on unified grid (all has_lab=True time_keys)
            # Get unified time keys that have lab data, sorted by order
            unified_lab_time_keys = [
                tk for tk, info in sorted(UNIFIED_TIME_MAP.items(), key=lambda x: x[1]["order"])
                if info.get("has_lab", False)
            ]
            
            # Map predictions by index to unified time keys
            # Ensure kre_preds and gfr_preds are lists
            if kre_preds is not None and not isinstance(kre_preds, list):
                kre_preds = None
            if gfr_preds is not None and not isinstance(gfr_preds, list):
                gfr_preds = None
            
            if kre_preds or gfr_preds:
                # Map predictions by time_order (unified grid format)
                # LAB predictions now include time_order and time_key
                for pred in (kre_preds or []):
                    if isinstance(pred, dict):
                        order = pred.get("time_order")
                        tk = pred.get("time_key")
                        if order is not None:
                            # Find base_key from order
                            base_key = None
                            for tk_check, info in UNIFIED_TIME_MAP.items():
                                if info.get("order") == order and info.get("has_lab"):
                                    base_key = tk_check
                                    break
                            if base_key:
                                if base_key not in lab_pred_lookup:
                                    lab_pred_lookup[base_key] = {}
                                lab_pred_lookup[base_key]["kre"] = pred
                        elif tk:
                            if tk not in lab_pred_lookup:
                                lab_pred_lookup[tk] = {}
                            lab_pred_lookup[tk]["kre"] = pred
                
                for pred in (gfr_preds or []):
                    if isinstance(pred, dict):
                        order = pred.get("time_order")
                        tk = pred.get("time_key")
                        if order is not None:
                            # Find base_key from order
                            base_key = None
                            for tk_check, info in UNIFIED_TIME_MAP.items():
                                if info.get("order") == order and info.get("has_lab"):
                                    base_key = tk_check
                                    break
                            if base_key:
                                if base_key not in lab_pred_lookup:
                                    lab_pred_lookup[base_key] = {}
                                lab_pred_lookup[base_key]["gfr"] = pred
                        elif tk:
                            if tk not in lab_pred_lookup:
                                lab_pred_lookup[tk] = {}
                            lab_pred_lookup[tk]["gfr"] = pred
                
                # Legacy format: index-based mapping (fallback)
                if not any(isinstance(p, dict) and p.get("time_order") is not None for p in (kre_preds or []) if isinstance(p, dict)):
                    for i, base_key in enumerate(unified_lab_time_keys):
                        if base_key not in lab_pred_lookup:
                            lab_pred_lookup[base_key] = {}
                        
                        if kre_preds and i < len(kre_preds) and isinstance(kre_preds[i], dict):
                            lab_pred_lookup[base_key]["kre"] = kre_preds[i]
                        if gfr_preds and i < len(gfr_preds) and isinstance(gfr_preds[i], dict):
                            lab_pred_lookup[base_key]["gfr"] = gfr_preds[i]
        
        if len(lab_sorted) > 0:
            for i, (_, row) in enumerate(lab_sorted.iterrows()):
                tk = row["time_key"]  # Already base key (e.g., "Day_7"), no suffix
                base_key = tk  # No need to strip suffix, it's already base key
                
                # Get KRE and GFR values - ensure they're properly extracted
                kre_val = row.get("kre")
                gfr_val = row.get("gfr")
                
                # Convert to float if not None/NaN, otherwise keep None
                if kre_val is not None and pd.notna(kre_val):
                    try:
                        kre_val = float(kre_val)
                    except (ValueError, TypeError):
                        kre_val = None
                else:
                    kre_val = None
                
                if gfr_val is not None and pd.notna(gfr_val):
                    try:
                        gfr_val = float(gfr_val)
                    except (ValueError, TypeError):
                        gfr_val = None
                else:
                    gfr_val = None
                
                # Only add to lookup if at least one value exists
                if kre_val is not None or gfr_val is not None:
                    lab_lookup[base_key] = {
                        "kre": kre_val,
                        "gfr": gfr_val,
                        "time_order": int(row.get("time_order", 0)) if pd.notna(row.get("time_order")) else None,
                        "pseudo_time_days": int(row.get("pseudo_time_days", 0)) if pd.notna(row.get("pseudo_time_days")) else None
                    }
                    # LAB anomaly scores
                    if lab_anomaly_scores and i < len(lab_anomaly_scores):
                        lab_anom_lookup[base_key] = lab_anomaly_scores[i]

        patient_kmr_points = len(kmr_sorted)
        patient_kre_points = int(lab_sorted["kre"].notna().sum()) if len(lab_sorted) > 0 else 0
        patient_gfr_points = int(lab_sorted["gfr"].notna().sum()) if len(lab_sorted) > 0 else 0

        def prediction_status(slot_enabled: bool, pred_value: Optional[float], n_points: int) -> str:
            if not slot_enabled:
                return "timepoint_not_applicable"
            if pred_value is not None:
                return "ok"
            if n_points < 3:
                return "insufficient_data"
            return "missing_prediction"
        
        # Create UNIFIED time points (all time_keys from unified grid: has_kmr=True or has_lab=True)
        # Include all unified grid points, not just those with actual data
        all_time_keys = set()
        for tk, info in UNIFIED_TIME_MAP.items():
            if info.get("has_kmr") or info.get("has_lab"):
                all_time_keys.add(tk)
        
        # Also include any time_keys from actual data (for backward compatibility)
        all_time_keys = all_time_keys | set(kmr_lookup.keys()) | set(lab_lookup.keys())
        
        # Sort by UNIFIED_TIME_MAP order
        def get_order(tk):
            return UNIFIED_TIME_MAP.get(tk, {}).get("order", 999)
        
        sorted_time_keys = sorted(all_time_keys, key=get_order)
        
        results = []
        consecutive_up = 0
        slopes = []
        prev_kmr = None
        kmr_history = []
        kre_history = []
        gfr_history = []
        
        for time_key in sorted_time_keys:
            # Get time info from UNIFIED_TIME_MAP
            time_info = UNIFIED_TIME_MAP.get(time_key, {"order": 999, "pseudo_days": 0})
            time_order = time_info.get("order", 999)
            
            # Get KMR data
            kmr_data = kmr_lookup.get(time_key, {})
            kmr_val = kmr_data.get("kmr")
            
            # Get LAB data
            lab_data = lab_lookup.get(time_key, {})
            kre_val = lab_data.get("kre")
            gfr_val = lab_data.get("gfr")

            # LAB trend must be point-in-time (no future leakage)
            if kre_val is not None:
                kre_history.append(kre_val)
            if gfr_val is not None:
                gfr_history.append(gfr_val)
            _, _, lab_trend = self.calc_lab_trend_score(kre_history, gfr_history)
            
            # Slot availability on unified grid
            has_kmr_slot = bool(time_info.get("has_kmr", False))
            has_lab_slot = bool(time_info.get("has_lab", False))

            # Get KMR prediction and anomaly data (by time_order first, then time_key)
            kmr_pred = kmr_pred_lookup.get(time_order) or kmr_pred_lookup.get(time_key, {})
            kmr_anom = kmr_anom_lookup.get(time_key, {})
            
            # Get LAB prediction and anomaly data
            # LAB time keys use base key (without _KRE/_GFR suffix)
            base_key = time_key.replace("_KRE", "").replace("_GFR", "")
            # Also try lookup by time_order
            lab_pred_base = lab_pred_lookup.get(base_key) or lab_pred_lookup.get(time_order, {})
            lab_pred_kre = lab_pred_base.get("kre", {}) if isinstance(lab_pred_base, dict) else {}
            lab_pred_gfr = lab_pred_base.get("gfr", {}) if isinstance(lab_pred_base, dict) else {}
            lab_anom = lab_anom_lookup.get(base_key, {})

            kmr_pred_val = kmr_pred.get("kmr_pred") if isinstance(kmr_pred, dict) else None
            kre_pred_val = lab_pred_kre.get("kre_pred") if isinstance(lab_pred_kre, dict) else None
            gfr_pred_val = lab_pred_gfr.get("gfr_pred") if isinstance(lab_pred_gfr, dict) else None

            kmr_pred_status = prediction_status(has_kmr_slot, kmr_pred_val, patient_kmr_points)
            kre_pred_status = prediction_status(has_lab_slot, kre_pred_val, patient_kre_points)
            gfr_pred_status = prediction_status(has_lab_slot, gfr_pred_val, patient_gfr_points)
            
            # Calculate KMR metrics only if KMR exists
            kmr_level = 0
            kmr_trend_score = 0
            kmr_volatility = 0
            kmr_ae = 0
            kmr_residual = 0
            kmr_risk = 0
            
            if kmr_val is not None:
                kmr_history.append(kmr_val)
                
                # Calculate slope
                if len(kmr_history) >= 3:
                    recent = kmr_history[-3:]
                    x = np.arange(len(recent))
                    slope = np.polyfit(x, recent, 1)[0]
                    slopes.append(slope)
                
                # Track consecutive increases
                if prev_kmr is not None and kmr_val > prev_kmr:
                    consecutive_up += 1
                else:
                    consecutive_up = 0
                prev_kmr = kmr_val
                
                # Calculate rolling CV
                window = kmr_history[-5:] if len(kmr_history) >= 5 else kmr_history
                cv = np.std(window) / (np.mean(window) + 1e-6) if len(window) > 1 else 0
                
                # KMR component scores
                kmr_level = self.calc_kmr_level_score(kmr_val, int(time_info.get("pseudo_days", 0)))
                kmr_trend_score = self.calc_kmr_trend_score(slopes, consecutive_up)
                kmr_volatility = self.calc_kmr_volatility_score(cv)
                kmr_ae = self.calc_kmr_ae_score(kmr_anom.get("kmr_anomaly_score", 0))
                kmr_residual = self.calc_kmr_residual_score(
                    kmr_pred.get("residual"), np.mean(kmr_history) if len(kmr_history) > 0 else 0.5
                )
                kmr_risk = self.calc_kmr_risk(kmr_level, kmr_trend_score, kmr_volatility, kmr_ae, kmr_residual)
            
            # LAB component scores
            kre_level = self.calc_kre_level_score(kre_val)
            gfr_level = self.calc_gfr_level_score(gfr_val)
            lab_level = None
            if kre_level is not None and gfr_level is not None:
                lab_level = 0.5 * kre_level + 0.5 * gfr_level
            elif kre_level is not None:
                lab_level = kre_level
            elif gfr_level is not None:
                lab_level = gfr_level
            
            # Get LAB anomaly scores
            kre_anom_score = lab_anom.get("kre_anomaly_score")
            gfr_anom_score = lab_anom.get("gfr_anomaly_score")
            
            has_current_measurement = (kmr_val is not None) or (kre_val is not None) or (gfr_val is not None)
            lab_trend_effective = lab_trend if has_current_measurement else None

            lab_risk = self.calc_lab_risk(kre_level, gfr_level, lab_trend_effective,
                                         kre_anom_score, gfr_anom_score)
            
            # Overall risk policy:
            # no current measurement at this time point -> risk stays 0 (no carry-forward).
            if not has_current_measurement:
                overall_risk = 0
            elif kmr_val is None and lab_risk is not None:
                overall_risk = lab_risk
            elif kmr_val is not None:
                overall_risk = self.calc_overall_risk(kmr_risk, lab_risk)
            else:
                overall_risk = 0
            
            alarm_level = self.determine_alarm_level(overall_risk)
            
            results.append({
                "time_key": time_key,
                "time_order": int(time_info["order"]),
                "pseudo_time_days": int(time_info["pseudo_days"]),
                "kmr": round(kmr_val, 4) if kmr_val is not None else None,
                "kre": round(kre_val, 2) if kre_val is not None else None,
                "gfr": round(gfr_val, 1) if gfr_val is not None else None,
                
                "kmr_pred": kmr_pred_val,
                "kmr_pred_lo": kmr_pred.get("kmr_pred_lo") if isinstance(kmr_pred, dict) else None,
                "kmr_pred_hi": kmr_pred.get("kmr_pred_hi") if isinstance(kmr_pred, dict) else None,
                "kmr_pred_status": kmr_pred_status,
                
                "kre_pred": kre_pred_val,
                "kre_pred_lo": lab_pred_kre.get("kre_pred_lo") if isinstance(lab_pred_kre, dict) else None,
                "kre_pred_hi": lab_pred_kre.get("kre_pred_hi") if isinstance(lab_pred_kre, dict) else None,
                "kre_pred_status": kre_pred_status,
                "gfr_pred": gfr_pred_val,
                "gfr_pred_lo": lab_pred_gfr.get("gfr_pred_lo") if isinstance(lab_pred_gfr, dict) else None,
                "gfr_pred_hi": lab_pred_gfr.get("gfr_pred_hi") if isinstance(lab_pred_gfr, dict) else None,
                "gfr_pred_status": gfr_pred_status,
                
                "kmr_anomaly_score": kmr_anom.get("kmr_anomaly_score", 0),
                "kmr_anomaly_flag": kmr_anom.get("kmr_anomaly_flag", False),
                "kre_anomaly_score": lab_anom.get("kre_anomaly_score"),
                "kre_anomaly_flag": lab_anom.get("kre_anomaly_flag", False),
                "gfr_anomaly_score": lab_anom.get("gfr_anomaly_score"),
                "gfr_anomaly_flag": lab_anom.get("gfr_anomaly_flag", False),
                
                "kre_level_score": round(kre_level, 1) if kre_level is not None else None,
                "gfr_level_score": round(gfr_level, 1) if gfr_level is not None else None,
                "lab_trend_score": round(lab_trend_effective, 1) if lab_trend_effective is not None else None,
                
                "risk_components": {
                    "kmr_level": round(kmr_level, 1),
                    "kmr_trend": round(kmr_trend_score, 1),
                    "kmr_volatility": round(kmr_volatility, 1),
                    "kmr_ae": round(kmr_ae, 1),
                    "kmr_residual": round(kmr_residual, 1),
                    "lab_level": round(lab_level, 1) if lab_level is not None else 0,
                    "lab_trend": round(lab_trend_effective, 1) if lab_trend_effective is not None else 0
                },
                "risk_score": round(overall_risk, 1),
                "risk_level": alarm_level
            })
        
        return results


if __name__ == "__main__":
    scorer = RiskScorer()
    
    # Test KRE scoring
    print("KRE Level Scores:")
    for kre in [0.8, 1.2, 2.0, 3.5, 4.5, 5.5]:
        print(f"  KRE {kre}: {scorer.calc_kre_level_score(kre):.1f}")
    
    print("\nGFR Level Scores:")
    for gfr in [100, 90, 60, 30, 15, 10]:
        print(f"  GFR {gfr}: {scorer.calc_gfr_level_score(gfr):.1f}")
