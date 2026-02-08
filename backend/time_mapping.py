"""
Time Mapping - Zaman noktalarını sıralama ve pseudo-days hesaplama
"""

# KMR time points with order and pseudo_days
KMR_TIME_MAP = {
    "Day_1":    {"order": 1,  "pseudo_days": 1},
    "Day_2":    {"order": 2,  "pseudo_days": 2},
    "Day_3":    {"order": 3,  "pseudo_days": 3},
    "Day_4":    {"order": 4,  "pseudo_days": 4},
    "Day_5":    {"order": 5,  "pseudo_days": 5},
    "Day_6":    {"order": 6,  "pseudo_days": 6},
    "Day_7":    {"order": 7,  "pseudo_days": 7},
    "Week_2":   {"order": 8,  "pseudo_days": 14},
    "Week_3":   {"order": 9,  "pseudo_days": 21},
    "Month_1":  {"order": 10, "pseudo_days": 30},
    "Month_2":  {"order": 11, "pseudo_days": 60},
    "Month_3":  {"order": 12, "pseudo_days": 90},
    "Month_4":  {"order": 13, "pseudo_days": 120},
    "Month_5":  {"order": 14, "pseudo_days": 150},
    "Month_6":  {"order": 15, "pseudo_days": 180},
    "Month_7":  {"order": 16, "pseudo_days": 210},
    "Month_8":  {"order": 17, "pseudo_days": 240},
    "Month_9":  {"order": 18, "pseudo_days": 270},
    "Month_10": {"order": 19, "pseudo_days": 300},
    "Month_11": {"order": 20, "pseudo_days": 330},
    "Month_12": {"order": 21, "pseudo_days": 365},
}

# LAB time points (KRE/GFR) - Day_7 added to match KMR structure
LAB_TIME_MAP = {
    "Day_7":    {"order": 1,  "pseudo_days": 7},
    "Week_2":   {"order": 2,  "pseudo_days": 14},
    "Week_3":   {"order": 3,  "pseudo_days": 21},
    "Month_1":  {"order": 4,  "pseudo_days": 30},
    "Month_2":  {"order": 5,  "pseudo_days": 60},
    "Month_3":  {"order": 6,  "pseudo_days": 90},
    "Month_4":  {"order": 7,  "pseudo_days": 120},
    "Month_5":  {"order": 8,  "pseudo_days": 150},
    "Month_6":  {"order": 9,  "pseudo_days": 180},
    "Month_12": {"order": 10, "pseudo_days": 365},
}

# Combined timeline for visualization (unified order)
# Includes ALL time points where either KMR or LAB data may exist
UNIFIED_TIME_MAP = {
    "Day_1":    {"order": 1,  "pseudo_days": 1,   "has_kmr": True, "has_lab": False},
    "Day_2":    {"order": 2,  "pseudo_days": 2,   "has_kmr": True, "has_lab": False},
    "Day_3":    {"order": 3,  "pseudo_days": 3,   "has_kmr": True, "has_lab": False},
    "Day_4":    {"order": 4,  "pseudo_days": 4,   "has_kmr": True, "has_lab": False},
    "Day_5":    {"order": 5,  "pseudo_days": 5,   "has_kmr": True, "has_lab": False},
    "Day_6":    {"order": 6,  "pseudo_days": 6,   "has_kmr": True, "has_lab": False},
    "Day_7":    {"order": 7,  "pseudo_days": 7,   "has_kmr": True, "has_lab": True},
    "Week_2":   {"order": 8,  "pseudo_days": 14,  "has_kmr": True, "has_lab": True},
    "Week_3":   {"order": 9,  "pseudo_days": 21,  "has_kmr": True, "has_lab": True},
    "Month_1":  {"order": 10, "pseudo_days": 30,  "has_kmr": True, "has_lab": True},
    "Month_2":  {"order": 11, "pseudo_days": 60,  "has_kmr": True, "has_lab": True},
    "Month_3":  {"order": 12, "pseudo_days": 90,  "has_kmr": True, "has_lab": True},
    "Month_4":  {"order": 13, "pseudo_days": 120, "has_kmr": True, "has_lab": True},
    "Month_5":  {"order": 14, "pseudo_days": 150, "has_kmr": True, "has_lab": True},
    "Month_6":  {"order": 15, "pseudo_days": 180, "has_kmr": True, "has_lab": True},
    "Month_7":  {"order": 16, "pseudo_days": 210, "has_kmr": True, "has_lab": False},
    "Month_8":  {"order": 17, "pseudo_days": 240, "has_kmr": True, "has_lab": False},
    "Month_9":  {"order": 18, "pseudo_days": 270, "has_kmr": True, "has_lab": False},
    "Month_10": {"order": 19, "pseudo_days": 300, "has_kmr": True, "has_lab": False},
    "Month_11": {"order": 20, "pseudo_days": 330, "has_kmr": True, "has_lab": False},
    "Month_12": {"order": 21, "pseudo_days": 365, "has_kmr": True, "has_lab": True},
}

def get_kmr_time_info(time_key: str) -> dict:
    """Get time info for KMR column"""
    return KMR_TIME_MAP.get(time_key, {"order": 0, "pseudo_days": 0})

def get_lab_time_info(time_key: str) -> dict:
    """Get time info for LAB column (strip _KRE/_GFR suffix)"""
    base_key = time_key.replace("_KRE", "").replace("_GFR", "")
    return LAB_TIME_MAP.get(base_key, {"order": 0, "pseudo_days": 0})

def get_unified_time_info(time_key: str) -> dict:
    """Get unified time info"""
    base_key = time_key.replace("_KRE", "").replace("_GFR", "")
    return UNIFIED_TIME_MAP.get(base_key, {"order": 0, "pseudo_days": 0, "has_kmr": False, "has_lab": False})

def get_all_time_keys() -> list:
    """Get all time keys in order"""
    return sorted(UNIFIED_TIME_MAP.keys(), key=lambda k: UNIFIED_TIME_MAP[k]["order"])
