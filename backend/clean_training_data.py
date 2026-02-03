#!/usr/bin/env python3
"""
Clean training data - Remove all generated JSON files for fresh training
"""
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import FRONTEND_PUBLIC, PATIENTS_DIR


def clean_training_data():
    """Remove all generated JSON files"""
    print("=" * 60)
    print("Cleaning training data...")
    print("=" * 60)
    
    files_to_remove = [
        FRONTEND_PUBLIC / "reference_band.json",
        FRONTEND_PUBLIC / "cohort_trajectory.json",
        FRONTEND_PUBLIC / "cohort_trajectory_lab.json",
        FRONTEND_PUBLIC / "data_summary.json",
        FRONTEND_PUBLIC / "patient_features.json",
        FRONTEND_PUBLIC / "channel_overview.json",
    ]
    
    removed_count = 0
    
    # Remove individual JSON files
    for filepath in files_to_remove:
        if filepath.exists():
            filepath.unlink()
            print(f"  Removed: {filepath.name}")
            removed_count += 1
        else:
            print(f"  Not found: {filepath.name} (skipping)")
    
    # Remove all patient JSON files
    if PATIENTS_DIR.exists():
        patient_files = list(PATIENTS_DIR.glob("*.json"))
        for patient_file in patient_files:
            patient_file.unlink()
            removed_count += 1
        print(f"  Removed {len(patient_files)} patient JSON files")
    else:
        print(f"  Patients directory not found: {PATIENTS_DIR}")
    
    print("\n" + "=" * 60)
    print(f"Cleanup complete! Removed {removed_count} files.")
    print("=" * 60)
    
    return removed_count


if __name__ == "__main__":
    clean_training_data()
