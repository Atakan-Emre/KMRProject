"""
Reference Band - Calculate reference bands from improved cohort
Includes fitted trend lines for improved patients
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime
from scipy.optimize import curve_fit
from scipy.stats import linregress

from .config import CLINICAL_THRESHOLDS
from .time_mapping import KMR_TIME_MAP, LAB_TIME_MAP, UNIFIED_TIME_MAP


def exponential_decay(t, a, b, c):
    """Exponential decay: a * exp(-b * t) + c"""
    return a * np.exp(-b * t) + c


def power_decay(t, a, b, c):
    """Power law decay: a / (t + 1)^b + c"""
    return a / np.power(t + 1, b) + c


class ReferenceBandCalculator:
    """Calculate reference bands from improved cohort patients"""
    
    def __init__(self):
        self.clinical = CLINICAL_THRESHOLDS
    
    def calculate_kmr_bands(self, kmr_long: pd.DataFrame, 
                            improved_patients: List[str]) -> List[dict]:
        """
        Calculate KMR reference bands from improved cohort
        
        Returns list of band data per time_key
        """
        # Filter to improved cohort
        cohort_df = kmr_long[kmr_long["patient_code"].isin(improved_patients)]
        
        if len(cohort_df) == 0:
            print("⚠️ No improved cohort data for KMR bands")
            return []
        
        bands = []
        for time_key in KMR_TIME_MAP.keys():
            time_data = cohort_df[cohort_df["time_key"] == time_key]["kmr"]
            
            if len(time_data) >= 2:  # Lower threshold from 3 to 2 for sparse LAB data
                bands.append({
                    "time_key": time_key,
                    "time_order": KMR_TIME_MAP[time_key]["order"],
                    "n_samples": len(time_data),
                    "median": round(float(time_data.median()), 4),
                    "mean": round(float(time_data.mean()), 4),
                    "std": round(float(time_data.std()), 4),
                    "p25": round(float(time_data.quantile(0.25)), 4),
                    "p75": round(float(time_data.quantile(0.75)), 4),
                    "p2_5": round(float(time_data.quantile(0.025)), 4),
                    "p97_5": round(float(time_data.quantile(0.975)), 4),
                    "min": round(float(time_data.min()), 4),
                    "max": round(float(time_data.max()), 4)
                })
        
        # Sort by time_order
        bands.sort(key=lambda x: x["time_order"])
        return bands
    
    def calculate_kmr_trend_line(self, kmr_long: pd.DataFrame,
                                  improved_patients: List[str]) -> dict:
        """
        Calculate fitted trend line from improved cohort's KMR data.
        Fits exponential decay and linear models, returns best fit.
        """
        cohort_df = kmr_long[kmr_long["patient_code"].isin(improved_patients)]
        
        if len(cohort_df) < 10:
            return {"error": "insufficient_data", "n_points": len(cohort_df)}
        
        # Aggregate by time_order: get median KMR at each time point
        agg = cohort_df.groupby("time_order").agg({
            "kmr": ["median", "mean", "std", "count"],
            "time_key": "first"
        }).reset_index()
        agg.columns = ["time_order", "median", "mean", "std", "count", "time_key"]
        agg = agg.sort_values("time_order")
        
        t = agg["time_order"].values.astype(float)
        y_median = agg["median"].values
        y_mean = agg["mean"].values
        
        result = {
            "n_patients": len(improved_patients),
            "n_time_points": len(agg),
            "time_points": agg["time_key"].tolist(),
            "observed_median": [round(v, 4) for v in y_median],
            "observed_mean": [round(v, 4) for v in y_mean],
        }
        
        # Try exponential decay fit
        try:
            # Initial guess: a=max(y), b=0.1, c=min(y)
            p0 = [max(y_median), 0.1, min(y_median)]
            popt_exp, _ = curve_fit(exponential_decay, t, y_median, p0=p0, maxfev=5000)
            y_pred_exp = exponential_decay(t, *popt_exp)
            ss_res_exp = np.sum((y_median - y_pred_exp) ** 2)
            ss_tot = np.sum((y_median - np.mean(y_median)) ** 2)
            r2_exp = 1 - (ss_res_exp / ss_tot) if ss_tot > 0 else 0
            
            result["exponential_fit"] = {
                "params": {"a": round(popt_exp[0], 4), "b": round(popt_exp[1], 4), "c": round(popt_exp[2], 4)},
                "formula": "a * exp(-b * t) + c",
                "r_squared": round(r2_exp, 4),
                "predicted": [round(v, 4) for v in y_pred_exp]
            }
        except Exception as e:
            result["exponential_fit"] = {"error": str(e)}
        
        # Try linear fit
        try:
            slope, intercept, r_value, _, _ = linregress(t, y_median)
            y_pred_lin = slope * t + intercept
            
            result["linear_fit"] = {
                "slope": round(slope, 6),
                "intercept": round(intercept, 4),
                "r_squared": round(r_value ** 2, 4),
                "predicted": [round(v, 4) for v in y_pred_lin],
                "trend": "decreasing" if slope < 0 else "increasing"
            }
        except Exception as e:
            result["linear_fit"] = {"error": str(e)}
        
        # Generate smooth curve for plotting (more points)
        t_smooth = np.linspace(1, max(t), 50)
        if "exponential_fit" in result and "params" in result["exponential_fit"]:
            params = result["exponential_fit"]["params"]
            smooth_exp = exponential_decay(t_smooth, params["a"], params["b"], params["c"])
            result["smooth_curve"] = {
                "t": [round(v, 2) for v in t_smooth],
                "kmr": [round(max(0, v), 4) for v in smooth_exp]  # Ensure non-negative
            }
        
        return result
    
    def calculate_kre_bands(self, lab_long: pd.DataFrame,
                            improved_patients: List[str]) -> List[dict]:
        """Calculate KRE reference bands from improved cohort - unified time order"""
        cohort_df = lab_long[lab_long["patient_code"].isin(improved_patients)]
        cohort_df = cohort_df[cohort_df["kre"].notna()]
        
        if len(cohort_df) == 0:
            print("⚠️ No improved cohort data for KRE bands")
            return []
        
        bands = []
        # Use unified time keys that have lab data
        for time_key, info in sorted(UNIFIED_TIME_MAP.items(), key=lambda x: x[1]["order"]):
            if not info["has_lab"]:
                continue
            
            # LAB time_key in lab_long is just the base key (e.g., "Month_6"), not "_KRE" suffix
            time_data = cohort_df[cohort_df["time_key"] == time_key]["kre"]
            
            if len(time_data) >= 2:  # Lower threshold from 3 to 2 for sparse LAB data
                bands.append({
                    "time_key": f"{time_key}_KRE",  # Add suffix for frontend compatibility
                    "time_order": info["order"],  # Unified time order (1-22)
                    "n_samples": len(time_data),
                    "median": round(float(time_data.median()), 2),
                    "mean": round(float(time_data.mean()), 2),
                    "std": round(float(time_data.std()), 2),
                    "p25": round(float(time_data.quantile(0.25)), 2),
                    "p75": round(float(time_data.quantile(0.75)), 2),
                    "p2_5": round(float(time_data.quantile(0.025)), 2),
                    "p97_5": round(float(time_data.quantile(0.975)), 2)
                })
        
        bands.sort(key=lambda x: x["time_order"])
        return bands
    
    def calculate_gfr_bands(self, lab_long: pd.DataFrame,
                            improved_patients: List[str]) -> List[dict]:
        """Calculate GFR reference bands from improved cohort - unified time order"""
        cohort_df = lab_long[lab_long["patient_code"].isin(improved_patients)]
        cohort_df = cohort_df[cohort_df["gfr"].notna()]
        
        if len(cohort_df) == 0:
            print("⚠️ No improved cohort data for GFR bands")
            return []
        
        bands = []
        # Use unified time keys that have lab data
        for time_key, info in sorted(UNIFIED_TIME_MAP.items(), key=lambda x: x[1]["order"]):
            if not info["has_lab"]:
                continue
            
            # LAB time_key in lab_long is just the base key (e.g., "Month_6"), not "_GFR" suffix
            time_data = cohort_df[cohort_df["time_key"] == time_key]["gfr"]
            
            if len(time_data) >= 2:  # Lower threshold from 3 to 2 for sparse LAB data
                bands.append({
                    "time_key": f"{time_key}_GFR",  # Add suffix for frontend compatibility
                    "time_order": info["order"],  # Unified time order (1-22)
                    "n_samples": len(time_data),
                    "median": round(float(time_data.median()), 1),
                    "mean": round(float(time_data.mean()), 1),
                    "std": round(float(time_data.std()), 1),
                    "p25": round(float(time_data.quantile(0.25)), 1),
                    "p75": round(float(time_data.quantile(0.75)), 1),
                    "p2_5": round(float(time_data.quantile(0.025)), 1),
                    "p97_5": round(float(time_data.quantile(0.975)), 1)
                })
        
        bands.sort(key=lambda x: x["time_order"])
        return bands
    
    def _get_lab_improved_patients(self, lab_long: pd.DataFrame, 
                                    improved_proxy: Dict[str, bool]) -> List[str]:
        """
        Get improved patients for LAB bands:
        - Either in improved_proxy (KMR-based) AND has LAB data
        - OR has LAB data with KRE < 1.2 or GFR >= 60 at later time points
        """
        improved_patients = [p for p, v in improved_proxy.items() if v]
        
        # Check which improved patients have LAB data
        lab_improved = []
        for patient in improved_patients:
            patient_lab = lab_long[lab_long["patient_code"] == patient]
            if len(patient_lab) > 0 and (patient_lab["kre"].notna().any() or patient_lab["gfr"].notna().any()):
                lab_improved.append(patient)
        
        # If not enough, expand to all patients with LAB data and good outcomes
        if len(lab_improved) < 5:
            # Check all patients for LAB-based improvement
            all_patients = lab_long["patient_code"].unique()
            for patient in all_patients:
                if patient in lab_improved:
                    continue
                
                patient_lab = lab_long[lab_long["patient_code"] == patient]
                # Check for good outcomes at later time points
                later_data = patient_lab[patient_lab["time_key"].str.contains("Month_6|Month_12", na=False, regex=True)]
                
                if len(later_data) > 0:
                    kre_good = later_data["kre"].dropna()
                    gfr_good = later_data["gfr"].dropna()
                    
                    if len(kre_good) > 0 and any(kre_good < 1.2):
                        lab_improved.append(patient)
                    elif len(gfr_good) > 0 and any(gfr_good >= 60):
                        lab_improved.append(patient)
        
        # If still not enough, use all patients with sufficient LAB data
        if len(lab_improved) < 3:
            # Get all patients with at least 3 LAB measurements
            patient_counts = lab_long.groupby("patient_code").size()
            patients_with_lab = patient_counts[patient_counts >= 3].index.tolist()
            lab_improved = list(set(lab_improved + patients_with_lab[:10]))  # Add up to 10 more
        
        return lab_improved
    
    def generate_reference_band_json(self, kmr_long: pd.DataFrame, 
                                     lab_long: pd.DataFrame,
                                     improved_proxy: Dict[str, bool]) -> dict:
        """
        Generate complete reference band JSON structure
        """
        improved_patients = [p for p, v in improved_proxy.items() if v]
        lab_improved_patients = self._get_lab_improved_patients(lab_long, improved_proxy)
        
        print(f"Calculating reference bands from {len(improved_patients)} improved patients (KMR)...")
        print(f"  Using {len(lab_improved_patients)} patients for LAB bands...")
        
        kmr_bands = self.calculate_kmr_bands(kmr_long, improved_patients)
        kre_bands = self.calculate_kre_bands(lab_long, lab_improved_patients)
        gfr_bands = self.calculate_gfr_bands(lab_long, lab_improved_patients)
        
        # Calculate trend line for improved cohort
        kmr_trend = self.calculate_kmr_trend_line(kmr_long, improved_patients)
        
        result = {
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "schema_version": "3.0",
                "cohort_definition": "improved_proxy = KMR Month_9..Month_12 any non-null",
                "improved_cohort_size": len(improved_patients),
                "improved_patients": improved_patients,
                "lab_cohort_size": len(lab_improved_patients),
                "lab_improved_patients": lab_improved_patients
            },
            "bands": {
                "kmr": kmr_bands,
                "kre": kre_bands,
                "gfr": gfr_bands
            },
            "trend_lines": {
                "kmr": kmr_trend
            },
            "clinical_thresholds": {
                "kmr": {
                    "normal_lt": self.clinical["kmr"]["normal_upper"],
                    "dikkat_0_5_to_2": True,
                    "kritik_2_to_5": True,
                    "cok_kritik_gt": self.clinical["kmr"]["kritik_upper"]
                },
                "kre": {
                    "very_good_lt": self.clinical["kre"]["very_good_lt"],
                    "very_bad_gt": self.clinical["kre"]["very_bad_gt"]
                },
                "gfr": {
                    "very_good_ge": self.clinical["gfr"]["very_good_ge"],
                    "very_bad_le": self.clinical["gfr"]["very_bad_le"]
                }
            }
        }
        
        trend_info = f"R²={kmr_trend.get('exponential_fit', {}).get('r_squared', 'N/A')}" if 'exponential_fit' in kmr_trend else "N/A"
        print(f"✅ Reference bands: KMR={len(kmr_bands)}, KRE={len(kre_bands)}, GFR={len(gfr_bands)}")
        print(f"📈 KMR trend line fitted: {trend_info}")
        
        return result


if __name__ == "__main__":
    from io_excel import load_all_data
    
    meta, kmr_long, lab_long, improved, raw = load_all_data()
    
    calculator = ReferenceBandCalculator()
    bands = calculator.generate_reference_band_json(kmr_long, lab_long, improved)
    
    print("\nKMR Bands sample:")
    for b in bands["bands"]["kmr"][:3]:
        print(f"  {b['time_key']}: median={b['median']}")
