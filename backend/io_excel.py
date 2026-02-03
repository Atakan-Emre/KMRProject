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
    Determine improved_proxy: True if patient has any KMR value in Month_9..Month_12
    """
    late_months = ["Month_9", "Month_10", "Month_11", "Month_12"]
    late_cols = [c for c in df.columns if c in late_months]
    
    result = {}
    for _, row in df.iterrows():
        patient = row["patient_code"]
        has_late = False
        for col in late_cols:
            if pd.notna(row.get(col)):
                has_late = True
                break
        result[patient] = has_late
    
    return result


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
