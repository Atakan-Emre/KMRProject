#!/usr/bin/env python3
"""
Run All - Main pipeline script for Kimerizm Tracking System
Executes all steps: Excel → Models → Risk Scoring → JSON Export
"""
import sys
import os
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import FRONTEND_PUBLIC, PATIENTS_DIR
from backend.io_excel import load_all_data
from backend.kmr_model import KMRPredictor
from backend.anomaly_vae import KMRAnomalyDetector
from backend.lab_model import LABPredictor
from backend.lab_anomaly_vae import LABAnomalyDetector
from backend.risk_scoring import RiskScorer
from backend.reference_band import ReferenceBandCalculator
from backend.cohort_trajectory import analyze_improved_cohort
from backend.cohort_trajectory_lab import analyze_improved_lab_cohort
from backend.export_json import JSONExporter


def clean_training_data():
    """Remove all generated JSON files for fresh training"""
    print("=" * 60)
    print("Step 0: Cleaning existing training data...")
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
    
    print(f"[OK] Cleanup complete! Removed {removed_count} files.\n")
    return removed_count


def run_pipeline():
    """Execute full data processing pipeline"""
    print("=" * 60)
    print("Kimerizm Takip Sistemi - Data Pipeline v3.0")
    print("=" * 60)
    
    # Step 0: Clean existing data
    clean_training_data()
    
    # Step 1: Load data from Excel
    print("Step 1: Loading Excel data...")
    meta_df, kmr_long, lab_long, improved_proxy, raw_df = load_all_data()
    
    # Step 2: Train prediction models
    print("\nStep 2: Training prediction models...")
    kmr_predictor = KMRPredictor()
    kmr_prediction_results = kmr_predictor.bulk_train(kmr_long)
    
    # Train LAB prediction models
    print("\nStep 2b: Training LAB prediction models...")
    lab_predictor = LABPredictor()
    lab_prediction_results = lab_predictor.bulk_train(lab_long)
    
    # Step 3: Train anomaly detector and score
    print("\nStep 3: Training anomaly detectors...")
    kmr_detector = KMRAnomalyDetector()
    kmr_detector.fit_global(kmr_long)
    kmr_anomaly_scores = kmr_detector.bulk_score(kmr_long)
    
    # Train LAB anomaly detector
    lab_detector = LABAnomalyDetector()
    lab_detector.fit_global(lab_long)
    lab_anomaly_scores = lab_detector.bulk_score(lab_long)
    
    # Step 4: Calculate risk scores for all patients
    print("\nStep 4: Calculating risk scores...")
    scorer = RiskScorer()
    timelines = {}
    
    patients = meta_df["patient_code"].unique()
    for i, patient in enumerate(patients):
        # Get patient data
        p_kmr = kmr_long[kmr_long["patient_code"] == patient].copy()
        p_lab = lab_long[lab_long["patient_code"] == patient].copy()
        
        if len(p_kmr) == 0 and len(p_lab) == 0:
            continue
        
        # Get KMR predictions and anomaly scores
        kmr_pred_result = kmr_prediction_results.get(patient, {})
        kmr_predictions = kmr_pred_result.get("predictions", [])
        kmr_anom_result = kmr_anomaly_scores.get(patient, [])
        
        # Get LAB predictions and anomaly scores
        lab_pred_result = lab_prediction_results.get(patient, {})
        lab_anom_result = lab_anomaly_scores.get(patient, [])
        
        # Pad KMR predictions if needed
        n_kmr_points = len(p_kmr)
        while len(kmr_predictions) < n_kmr_points:
            kmr_predictions.append({
                "kmr_pred": None, "kmr_pred_lo": None, 
                "kmr_pred_hi": None, "residual": 0
            })
        while len(kmr_anom_result) < n_kmr_points:
            kmr_anom_result.append({"kmr_anomaly_score": 0, "kmr_anomaly_flag": False})
        
        # Score timeline (includes LAB predictions and anomaly scores)
        try:
            timeline = scorer.score_patient_timeline(
                p_kmr, p_lab, kmr_predictions, kmr_anom_result,
                lab_pred_result, lab_anom_result
            )
            timelines[patient] = timeline
        except Exception as e:
            print(f"[WARNING] Error scoring timeline for {patient}: {e}")
            timelines[patient] = []
        
        if (i + 1) % 10 == 0:
            print(f"   Scored {i+1}/{len(patients)} patients")
    
    print(f"[OK] Risk scoring complete for {len(timelines)} patients")
    
    # Step 5: Calculate reference bands
    print("\nStep 5: Calculating reference bands...")
    band_calculator = ReferenceBandCalculator()
    reference_bands = band_calculator.generate_reference_band_json(
        kmr_long, lab_long, improved_proxy
    )
    
    # Step 5b: Analyze improved cohort trajectory (LSTM/VAE)
    print("\nStep 5b: Analyzing improved cohort trajectory...")
    improved_patients = [p for p, v in improved_proxy.items() if v]
    cohort_trajectory = analyze_improved_cohort(kmr_long, improved_patients)
    
    # Analyze LAB cohort trajectory
    print("\nStep 5c: Analyzing improved LAB cohort trajectory...")
    lab_cohort_trajectory = analyze_improved_lab_cohort(lab_long, improved_patients)
    
    # Step 6: Export JSON files
    print("\nStep 6: Exporting JSON files...")
    exporter = JSONExporter()
    
    # Export patient files and get last status
    patient_risks = exporter.bulk_export_patients(
        meta_df, kmr_long, lab_long, timelines
    )
    
    # Export reference band
    exporter.export_reference_band(reference_bands)
    
    # Export cohort trajectory
    if "error" not in cohort_trajectory:
        exporter.export_cohort_trajectory(cohort_trajectory)
    
    # Export LAB cohort trajectory
    if lab_cohort_trajectory and isinstance(lab_cohort_trajectory, dict) and "error" not in lab_cohort_trajectory:
        try:
            filepath = exporter.output_dir / "cohort_trajectory_lab.json"
            with open(filepath, 'w', encoding='utf-8') as f:
                import json
                from backend.export_json import sanitize_for_json
                json.dump(sanitize_for_json(lab_cohort_trajectory), f, ensure_ascii=False, indent=2)
            print(f"[OK] Exported: {filepath}")
        except Exception as e:
            print(f"[WARNING] Error exporting LAB cohort trajectory: {e}")
    else:
        error_msg = lab_cohort_trajectory.get('error', 'unknown error') if isinstance(lab_cohort_trajectory, dict) else 'invalid format'
        print(f"[WARNING] LAB cohort trajectory not exported: {error_msg}")
    
    # Export summary
    exporter.export_data_summary(meta_df, patient_risks)
    
    # Export patient features
    exporter.export_patient_features(meta_df, patient_risks, kmr_long, lab_long, timelines)
    
    # Export channel overview
    exporter.export_channel_overview(kmr_long, lab_long)
    
    # Done
    print("\n" + "=" * 60)
    print("Pipeline complete!")
    print(f"   Output directory: {FRONTEND_PUBLIC}")
    print(f"   Patients exported: {len(timelines)}")
    print("=" * 60)
    
    return {
        "n_patients": len(timelines),
        "n_improved": sum(improved_proxy.values()),
        "output_dir": str(FRONTEND_PUBLIC)
    }


if __name__ == "__main__":
    result = run_pipeline()
    print(f"\nResult: {result}")
