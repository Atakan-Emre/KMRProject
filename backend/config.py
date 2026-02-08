"""
Kimerizm Takip Sistemi - Konfigürasyon
"""
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
FRONTEND_PUBLIC = PROJECT_ROOT / "frontend" / "public"
PATIENTS_DIR = FRONTEND_PUBLIC / "patients"

# Excel file
EXCEL_FILE = DATA_DIR / "data.xlsx"

# Time mapping configuration
TIME_CONFIG = {
    # KMR time points
    "kmr_columns": [
        "Day_1", "Day_2", "Day_3", "Day_4", "Day_5", "Day_6", "Day_7",
        "Week_2", "Week_3", "Month_1",
        "Month_2", "Month_3", "Month_4", "Month_5", "Month_6",
        "Month_7", "Month_8", "Month_9", "Month_10", "Month_11", "Month_12"
    ],
    # KRE/GFR time points
    "lab_time_keys": [
        "Week_1", "Week_2", "Week_3",
        "Month_1", "Month_2", "Month_3", "Month_4", "Month_5", "Month_6", "Month_12"
    ]
}

# Model configuration
MODEL_CONFIG = {
    "seq_len_min": 5,
    "seq_len_max": 12,
    "physics_lambda": 0.03,
    "random_seed": 42,
    "complexity_thresholds": {
        "simple": 10,
        "medium": 20
    }
}

# Risk scoring weights
RISK_WEIGHTS = {
    # KMR components
    "kmr_level": 0.35,
    "kmr_trend": 0.25,
    "kmr_volatility": 0.10,
    "kmr_ae": 0.15,
    "kmr_residual": 0.15,
    # LAB components
    "lab_level_weight": 0.6,
    "lab_trend_weight": 0.4,
    # Overall blend - dengeli orta yol
    "kmr_weight": 0.65,
    "lab_weight": 0.35
}

# Clinical thresholds
CLINICAL_THRESHOLDS = {
    "kmr": {
        "normal_upper": 0.5,
        "dikkat_upper": 2.0,
        "kritik_upper": 5.0
    },
    "kre": {
        "very_good_lt": 1.2,
        "very_bad_gt": 4.5
    },
    "gfr": {
        "very_good_ge": 90,
        "very_bad_le": 15
    }
}

# Alarm thresholds - dengeli kalibre edilmiş eşikler
ALARM_THRESHOLDS = {
    "dikkat": 30,
    "kritik": 60,
    "cok_kritik": 80
}

# Anomaly detection
ANOMALY_CONFIG = {
    "iqr_multiplier": 1.5,
    "cvae_beta": 0.7
}
