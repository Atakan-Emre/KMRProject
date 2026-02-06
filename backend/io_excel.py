"""
Excel I/O - data.xlsx okuma ve temizleme
"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Tuple, Dict, List

from .config import EXCEL_FILE, TIME_CONFIG
from .time_mapping import KMR_TIME_MAP, LAB_TIME_MAP, get_kmr_time_info, get_lab_time_info


def load_excel(filepath: Path = None) -> pd.DataFrame:
    """Load and clean Excel file"""
    filepath = filepath or EXCEL_FILE
    df = pd.read_excel(filepath)
    
    # Normalize column names (fix typos like "Month_2_ KRE")
    df.columns = [col.replace(" ", "").strip() for col in df.columns]
    
    # Ensure patient_code is string
    df["patient_code"] = df["patient_code"].astype(str)
    
    return df


def extract_meta(df: pd.DataFrame) -> pd.DataFrame:
    """Extract meta columns"""
    meta_cols = ["patient_code", "age", "BMI", "vital_status", "blood_group", "gender"]
    return df[meta_cols].copy()


def wide_to_long_kmr(df: pd.DataFrame) -> pd.DataFrame:
    """Convert wide KMR columns to long format"""
    kmr_cols = [c for c in df.columns if c in KMR_TIME_MAP]
    
    records = []
    for _, row in df.iterrows():
        patient = row["patient_code"]
        for col in kmr_cols:
            val = row[col]
            if pd.notna(val):
                info = get_kmr_time_info(col)
                records.append({
                    "patient_code": patient,
                    "time_key": col,
                    "time_order": info["order"],
                    "pseudo_time_days": info["pseudo_days"],
                    "kmr": float(val)
                })
    
    return pd.DataFrame(records)


def wide_to_long_lab(df: pd.DataFrame) -> pd.DataFrame:
    """Convert wide KRE/GFR columns to long format"""
    # Find KRE and GFR columns
    kre_cols = [c for c in df.columns if c.endswith("_KRE")]
    gfr_cols = [c for c in df.columns if c.endswith("_GFR")]
    
    # Build time_key -> (kre_col, gfr_col) mapping
    time_keys = set()
    for c in kre_cols:
        time_keys.add(c.replace("_KRE", ""))
    for c in gfr_cols:
        time_keys.add(c.replace("_GFR", ""))
    
    records = []
    for _, row in df.iterrows():
        patient = row["patient_code"]
        for tk in time_keys:
            kre_col = f"{tk}_KRE"
            gfr_col = f"{tk}_GFR"
            
            kre_val = row.get(kre_col, np.nan)
            gfr_val = row.get(gfr_col, np.nan)
            
            # Only add if at least one value exists
            if pd.notna(kre_val) or pd.notna(gfr_val):
                info = get_lab_time_info(tk)
                records.append({
                    "patient_code": patient,
                    "time_key": tk,
                    "time_order": info["order"],
                    "pseudo_time_days": info["pseudo_days"],
                    "kre": float(kre_val) if pd.notna(kre_val) else None,
                    "gfr": float(gfr_val) if pd.notna(gfr_val) else None
                })
    
    return pd.DataFrame(records)


def calculate_improved_proxy(df: pd.DataFrame) -> Dict[str, bool]:
    """
    Determine improved_proxy using late follow-up + clinical trend criteria.

    Rule set:
    - Candidate cohort: has at least one KMR value in Month_9..Month_12
    - Clinical improvement:
      - KMR improves (last < 0.5 OR strong reduction vs first value)
      - KRE improves when available (last < 1.2 OR last <= first)
      - GFR improves when available (last >= 90 OR last >= first)

    If the strict cohort becomes too small, fallback to candidate cohort to keep
    training stable.
    """
    kmr_keys = sorted(KMR_TIME_MAP.keys(), key=lambda k: KMR_TIME_MAP[k]["order"])
    lab_keys = sorted(LAB_TIME_MAP.keys(), key=lambda k: LAB_TIME_MAP[k]["order"])

    late_months = ["Month_9", "Month_10", "Month_11", "Month_12"]
    late_cols = [c for c in df.columns if c in late_months]

    strict_result: Dict[str, bool] = {}
    candidate_result: Dict[str, bool] = {}

    for _, row in df.iterrows():
        patient = row["patient_code"]
        has_late = False
        for col in late_cols:
            if pd.notna(row.get(col)):
                has_late = True
                break

        candidate_result[patient] = has_late
        if not has_late:
            strict_result[patient] = False
            continue

        # KMR first/last
        kmr_vals = [float(row.get(k)) for k in kmr_keys if pd.notna(row.get(k))]
        first_kmr = kmr_vals[0] if kmr_vals else None
        last_kmr = kmr_vals[-1] if kmr_vals else None

        kmr_improved = False
        if last_kmr is not None:
            kmr_improved = (
                last_kmr < 0.5
                or (first_kmr is not None and first_kmr > 0 and last_kmr <= first_kmr * 0.35)
            )

        # KRE first/last
        kre_vals = [float(row.get(f"{k}_KRE")) for k in lab_keys if pd.notna(row.get(f"{k}_KRE"))]
        first_kre = kre_vals[0] if kre_vals else None
        last_kre = kre_vals[-1] if kre_vals else None
        kre_improved = (
            last_kre is None
            or last_kre < 1.2
            or (first_kre is not None and last_kre <= first_kre)
        )

        # GFR first/last
        gfr_vals = [float(row.get(f"{k}_GFR")) for k in lab_keys if pd.notna(row.get(f"{k}_GFR"))]
        first_gfr = gfr_vals[0] if gfr_vals else None
        last_gfr = gfr_vals[-1] if gfr_vals else None
        gfr_improved = (
            last_gfr is None
            or last_gfr >= 90
            or (first_gfr is not None and last_gfr >= first_gfr)
        )

        strict_result[patient] = kmr_improved and kre_improved and gfr_improved

    strict_count = sum(strict_result.values())
    min_required = max(5, int(len(df) * 0.15))

    if strict_count < min_required:
        print(
            f"   Improved proxy strict cohort too small ({strict_count}); "
            f"fallback to late-follow-up cohort ({sum(candidate_result.values())})"
        )
        return candidate_result

    return strict_result


def load_all_data() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, bool], pd.DataFrame]:
    """
    Load all data from Excel
    
    Returns:
        meta_df: Patient metadata
        kmr_long: KMR long format
        lab_long: LAB (KRE/GFR) long format
        improved_proxy: Dict of patient -> bool
        raw_df: Original wide dataframe
    """
    df = load_excel()
    
    meta_df = extract_meta(df)
    kmr_long = wide_to_long_kmr(df)
    lab_long = wide_to_long_lab(df)
    improved_proxy = calculate_improved_proxy(df)
    
    # Add improved_proxy to meta
    meta_df["improved_proxy"] = meta_df["patient_code"].map(improved_proxy)
    
    print(f"Loaded {len(meta_df)} patients")
    print(f"   KMR measurements: {len(kmr_long)}")
    print(f"   LAB measurements: {len(lab_long)}")
    print(f"   Improved proxy count: {sum(improved_proxy.values())}")
    
    return meta_df, kmr_long, lab_long, improved_proxy, df


if __name__ == "__main__":
    meta, kmr, lab, improved, raw = load_all_data()
    print("\nKMR sample:")
    print(kmr.head(10))
    print("\nLAB sample:")
    print(lab.head(10))
