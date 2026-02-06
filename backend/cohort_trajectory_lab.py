"""
LAB Cohort Trajectory - LSTM/VAE based expected trajectory for improved patients (KRE/GFR)
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime

import tensorflow as tf
from tensorflow import keras
from keras import layers, Model

from .time_mapping import LAB_TIME_MAP, UNIFIED_TIME_MAP, get_lab_time_info, get_unified_time_info


class LABCohortTrajectoryAnalyzer:
    """
    Analyzes improved cohort to generate expected KRE/GFR trajectory.
    Uses LSTM for sequence modeling and autoencoder for confidence bounds.
    """
    
    def __init__(self):
        self.lstm_model_kre = None
        self.lstm_model_gfr = None
        self.lstm_model_multi = None
        self.autoencoder_kre = None
        self.autoencoder_gfr = None
        self.autoencoder_multi = None
        self.scaler_kre_mean = 0
        self.scaler_kre_std = 1
        self.scaler_gfr_mean = 0
        self.scaler_gfr_std = 1
        
    def _get_improved_lab_patients(self, lab_long: pd.DataFrame, improved_patients: List[str]) -> List[str]:
        """
        Identify improved patients based on LAB criteria:
        - KRE < 1.2 and/or GFR >= 60 at clinically late time points
        - Requires at least 3 LAB measurements for model stability
        """
        improved_lab_patients = []

        # Dataset mostly contains Month_6 and Month_12 for late LAB controls.
        # Keep Month_9..Month_11 for forward compatibility if present.
        late_time_keys = ["Month_6", "Month_9", "Month_10", "Month_11", "Month_12"]
        
        for patient in improved_patients:
            patient_data = lab_long[lab_long["patient_code"] == patient]
            
            if len(patient_data) == 0:
                continue
            
            # Check if patient has sufficient LAB data (≥3 measurements)
            kre_count = patient_data["kre"].notna().sum()
            gfr_count = patient_data["gfr"].notna().sum()
            
            if kre_count < 3 and gfr_count < 3:
                continue
            
            # Check if patient has improved LAB profile at clinically late controls
            late_data = patient_data[patient_data["time_key"].isin(late_time_keys)]
            if len(late_data) == 0:
                continue

            kre_values = late_data["kre"].dropna()
            gfr_values = late_data["gfr"].dropna()
            is_improved = (
                (len(kre_values) > 0 and bool((kre_values < 1.2).any())) or
                (len(gfr_values) > 0 and bool((gfr_values >= 60).any()))
            )

            if is_improved:
                improved_lab_patients.append(patient)
        
        return improved_lab_patients
    
    def prepare_cohort_sequences(self, lab_long: pd.DataFrame, 
                                  improved_patients: List[str]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Prepare cohort data as sequences for LSTM training.
        Uses unified time grid (UNIFIED_TIME_MAP order 1-22).
        """
        # Filter to improved patients
        cohort_df = lab_long[lab_long["patient_code"].isin(improved_patients)].copy()
        
        # Get unified time keys that have lab data
        unified_time_keys = [tk for tk, info in sorted(UNIFIED_TIME_MAP.items(), key=lambda x: x[1]["order"]) 
                            if info["has_lab"]]
        n_time_points = len(unified_time_keys)
        
        kre_sequences = []
        gfr_sequences = []
        patient_ids = []
        
        for patient in improved_patients:
            patient_data = cohort_df[cohort_df["patient_code"] == patient]
            
            # Create sequences with NaN for missing points
            kre_seq = np.full(n_time_points, np.nan)
            gfr_seq = np.full(n_time_points, np.nan)
            
            for _, row in patient_data.iterrows():
                time_key = row["time_key"]
                # LAB data from io_excel.py uses base time_key (e.g., "Day_7")
                # without _KRE/_GFR suffix. Each row has both kre and gfr columns.
                base_key = time_key.replace("_KRE", "").replace("_GFR", "")
                
                if base_key in unified_time_keys:
                    idx = unified_time_keys.index(base_key)
                    
                    # Both kre and gfr are in the same row
                    kre_val = row.get("kre")
                    gfr_val = row.get("gfr")
                    
                    if pd.notna(kre_val):
                        kre_seq[idx] = float(kre_val)
                    if pd.notna(gfr_val):
                        gfr_seq[idx] = float(gfr_val)
            
            # Only include if patient has at least 3 measurements for either metric
            # Lowered threshold per user requirement (min_sequences=3)
            kre_valid = np.sum(~np.isnan(kre_seq))
            gfr_valid = np.sum(~np.isnan(gfr_seq))
            
            if kre_valid >= 3 or gfr_valid >= 3:
                kre_sequences.append(kre_seq)
                gfr_sequences.append(gfr_seq)
                patient_ids.append(patient)
        
        return np.array(kre_sequences), np.array(gfr_sequences), unified_time_keys
    
    def interpolate_sequences(self, sequences: np.ndarray) -> np.ndarray:
        """Interpolate missing values in sequences using linear interpolation"""
        interpolated = sequences.copy()
        
        for i in range(len(sequences)):
            seq = sequences[i]
            valid_idx = np.where(~np.isnan(seq))[0]
            
            if len(valid_idx) < 2:
                continue
            
            # Linear interpolation
            for j in range(len(seq)):
                if np.isnan(seq[j]):
                    left = valid_idx[valid_idx < j]
                    right = valid_idx[valid_idx > j]
                    
                    if len(left) > 0 and len(right) > 0:
                        l_idx, r_idx = left[-1], right[0]
                        ratio = (j - l_idx) / (r_idx - l_idx)
                        interpolated[i, j] = seq[l_idx] + ratio * (seq[r_idx] - seq[l_idx])
                    elif len(left) > 0:
                        interpolated[i, j] = seq[left[-1]]
                    elif len(right) > 0:
                        interpolated[i, j] = seq[right[0]]
        
        return interpolated
    
    def build_lstm_model(self, n_time_points: int, output_dim: int = 1) -> Any:
        """Build LSTM model for sequence prediction"""
        inputs = layers.Input(shape=(n_time_points, output_dim))
        
        # Encoder
        x = layers.LSTM(32, return_sequences=True)(inputs)
        x = layers.Dropout(0.2)(x)
        x = layers.LSTM(16, return_sequences=True)(x)
        
        # Decoder
        x = layers.LSTM(16, return_sequences=True)(x)
        x = layers.LSTM(32, return_sequences=True)(x)
        outputs = layers.TimeDistributed(layers.Dense(output_dim))(x)
        
        model = Model(inputs, outputs, name="lab_cohort_lstm")
        model.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        
        return model
    
    def build_autoencoder(self, n_time_points: int) -> Tuple[Any, Any]:
        """Build autoencoder for trajectory confidence bounds"""
        inputs = layers.Input(shape=(n_time_points,))
        
        # Encoder
        x = layers.Dense(32, activation="relu")(inputs)
        x = layers.Dense(16, activation="relu")(x)
        encoded = layers.Dense(8, activation="relu")(x)
        
        # Decoder
        x = layers.Dense(16, activation="relu")(encoded)
        x = layers.Dense(32, activation="relu")(x)
        decoded = layers.Dense(n_time_points)(x)
        
        autoencoder = Model(inputs, decoded, name="lab_trajectory_ae")
        autoencoder.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        
        encoder = Model(inputs, encoded, name="lab_trajectory_encoder")
        
        return autoencoder, encoder
    
    def fit(self, lab_long: pd.DataFrame, improved_patients: List[str], 
            epochs: int = 100) -> dict:
        """
        Fit LSTM and autoencoder models on improved cohort data.
        """
        print(f"🧬 Analyzing LAB cohort trajectory for {len(improved_patients)} improved patients...")
        
        # Filter to improved LAB patients
        improved_lab = self._get_improved_lab_patients(lab_long, improved_patients)
        
        print(f"   Found {len(improved_lab)} improved LAB patients (from {len(improved_patients)} improved patients)")
        
        # Store improved_lab for later use in trajectory generation
        self._last_improved_lab = improved_lab
        
        # Lowered threshold: require at least 2 patients (minimum for cohort)
        # If not enough, try to use all improved patients with sufficient LAB data
        if len(improved_lab) < 2:
            # Fallback: use all improved patients with ≥3 LAB measurements
            fallback_lab = []
            for patient in improved_patients:
                patient_data = lab_long[lab_long["patient_code"] == patient]
                kre_count = patient_data["kre"].notna().sum()
                gfr_count = patient_data["gfr"].notna().sum()
                if kre_count >= 3 or gfr_count >= 3:
                    fallback_lab.append(patient)
            
            if len(fallback_lab) >= 2:
                print(f"   Using fallback: {len(fallback_lab)} patients with ≥3 LAB measurements")
                improved_lab = fallback_lab
            else:
                print(f"   ⚠️ Insufficient patients: {len(improved_lab)} improved, {len(fallback_lab)} fallback")
                return {"error": "insufficient_patients", "n_patients": len(improved_lab), "fallback_n": len(fallback_lab)}
        
        # Prepare sequences
        kre_sequences, gfr_sequences, time_keys = self.prepare_cohort_sequences(lab_long, improved_lab)
        
        # Lowered threshold: require at least 2 sequences (minimum for LSTM)
        if len(kre_sequences) < 2:
            print(f"   ⚠️ Insufficient sequences: {len(kre_sequences)} (need at least 2)")
            return {"error": "insufficient_sequences", "n_sequences": len(kre_sequences), "n_patients": len(improved_lab)}
        
        # Check GFR data availability
        has_gfr_sequences = len(gfr_sequences) > 0
        if has_gfr_sequences:
            # Check if GFR sequences have enough valid data
            gfr_valid_counts = [np.sum(~np.isnan(seq)) for seq in gfr_sequences]
            has_gfr_sequences = sum(gfr_valid_counts) >= 3  # At least 3 total GFR measurements across all patients
        
        # Interpolate missing values
        kre_sequences_interp = self.interpolate_sequences(kre_sequences)
        gfr_sequences_interp = self.interpolate_sequences(gfr_sequences) if has_gfr_sequences else np.array([])
        
        n_time_points = len(time_keys)
        
        # Normalize KRE
        self.scaler_kre_mean = np.nanmean(kre_sequences_interp)
        self.scaler_kre_std = np.nanstd(kre_sequences_interp)
        if self.scaler_kre_std < 0.001:
            self.scaler_kre_std = 1.0
        
        kre_sequences_norm = (kre_sequences_interp - self.scaler_kre_mean) / self.scaler_kre_std
        
        # Normalize GFR (only if we have GFR sequences)
        if has_gfr_sequences and len(gfr_sequences_interp) > 0:
            self.scaler_gfr_mean = np.nanmean(gfr_sequences_interp)
            self.scaler_gfr_std = np.nanstd(gfr_sequences_interp)
            if self.scaler_gfr_std < 0.001:
                self.scaler_gfr_std = 1.0
            
            gfr_sequences_norm = (gfr_sequences_interp - self.scaler_gfr_mean) / self.scaler_gfr_std
        else:
            self.scaler_gfr_mean = 0
            self.scaler_gfr_std = 1.0
            gfr_sequences_norm = np.array([])
        
        # Train KRE LSTM
        print("   Training KRE LSTM sequence model...")
        self.lstm_model_kre = self.build_lstm_model(n_time_points, 1)
        X_kre = kre_sequences_norm.reshape(-1, n_time_points, 1)
        
        self.lstm_model_kre.fit(
            X_kre, X_kre,
            epochs=epochs,
            batch_size=max(1, len(kre_sequences) // 4),
            verbose=0
        )
        
        # Train GFR LSTM (only if we have valid GFR sequences)
        has_gfr_data = has_gfr_sequences and len(gfr_sequences_interp) > 0 and not np.all(np.isnan(gfr_sequences_interp))
        if has_gfr_data:
            print("   Training GFR LSTM sequence model...")
            try:
                self.lstm_model_gfr = self.build_lstm_model(n_time_points, 1)
                X_gfr = gfr_sequences_norm.reshape(-1, n_time_points, 1)
                
                self.lstm_model_gfr.fit(
                    X_gfr, X_gfr,
                    epochs=epochs,
                    batch_size=max(1, len(gfr_sequences) // 4),
                    verbose=0
                )
            except Exception as e:
                print(f"   ⚠️ GFR LSTM training failed: {e}")
                self.lstm_model_gfr = None
        else:
            print("   ⚠️ Skipping GFR LSTM training: insufficient GFR data")
            self.lstm_model_gfr = None
        
        # Train Autoencoders
        print("   Training autoencoders for bounds...")
        self.autoencoder_kre, self.encoder_kre = self.build_autoencoder(n_time_points)
        
        try:
            self.autoencoder_kre.fit(
                kre_sequences_norm, kre_sequences_norm,
                epochs=epochs,
                batch_size=max(1, len(kre_sequences) // 4),
                verbose=0
            )
        except Exception as e:
            print(f"   ⚠️ KRE autoencoder training failed: {e}")
            self.autoencoder_kre = None
        
        if has_gfr_data:
            self.autoencoder_gfr, self.encoder_gfr = self.build_autoencoder(n_time_points)
            try:
                self.autoencoder_gfr.fit(
                    gfr_sequences_norm, gfr_sequences_norm,
                    epochs=epochs,
                    batch_size=max(1, len(gfr_sequences) // 4),
                    verbose=0
                )
            except Exception as e:
                print(f"   ⚠️ GFR autoencoder training failed: {e}")
                self.autoencoder_gfr = None
        else:
            print("   ⚠️ Skipping GFR autoencoder training: insufficient GFR data")
            self.autoencoder_gfr = None
            self.encoder_gfr = None
        
        return {
            "n_patients": len(kre_sequences),
            "n_time_points": n_time_points,
            "time_keys": time_keys,
            "scaler_kre_mean": float(self.scaler_kre_mean),
            "scaler_kre_std": float(self.scaler_kre_std),
            "scaler_gfr_mean": float(self.scaler_gfr_mean),
            "scaler_gfr_std": float(self.scaler_gfr_std)
        }
    
    def generate_expected_trajectory(self, lab_long: pd.DataFrame,
                                    improved_patients: List[str]) -> dict:
        """
        Generate expected trajectory with confidence bounds for KRE and GFR.
        """
        improved_lab = self._get_improved_lab_patients(lab_long, improved_patients)
        kre_sequences, gfr_sequences, time_keys = self.prepare_cohort_sequences(lab_long, improved_lab)
        
        # Check GFR data availability
        has_gfr_sequences = len(gfr_sequences) > 0
        if has_gfr_sequences:
            gfr_valid_counts = [np.sum(~np.isnan(seq)) for seq in gfr_sequences]
            has_gfr_sequences = sum(gfr_valid_counts) >= 3
        
        kre_sequences_interp = self.interpolate_sequences(kre_sequences)
        if has_gfr_sequences:
            gfr_sequences_interp = self.interpolate_sequences(gfr_sequences)
        else:
            gfr_sequences_interp = np.array([])
        
        n_time_points = len(time_keys)
        
        # Calculate cohort statistics
        kre_cohort_mean = np.nanmean(kre_sequences_interp, axis=0)
        kre_cohort_median = np.nanmedian(kre_sequences_interp, axis=0)
        kre_cohort_std = np.nanstd(kre_sequences_interp, axis=0)
        kre_cohort_p25 = np.nanpercentile(kre_sequences_interp, 25, axis=0)
        kre_cohort_p75 = np.nanpercentile(kre_sequences_interp, 75, axis=0)
        kre_cohort_p10 = np.nanpercentile(kre_sequences_interp, 10, axis=0)
        kre_cohort_p90 = np.nanpercentile(kre_sequences_interp, 90, axis=0)
        
        # Check if GFR sequences are valid (not all NaN)
        has_gfr_data = len(gfr_sequences_interp) > 0 and not np.all(np.isnan(gfr_sequences_interp))
        
        gfr_cohort_mean = np.nanmean(gfr_sequences_interp, axis=0) if has_gfr_data else np.full(n_time_points, np.nan)
        gfr_cohort_median = np.nanmedian(gfr_sequences_interp, axis=0) if has_gfr_data else np.full(n_time_points, np.nan)
        gfr_cohort_std = np.nanstd(gfr_sequences_interp, axis=0) if has_gfr_data else np.full(n_time_points, np.nan)
        gfr_cohort_p25 = np.nanpercentile(gfr_sequences_interp, 25, axis=0) if has_gfr_data else np.full(n_time_points, np.nan)
        gfr_cohort_p75 = np.nanpercentile(gfr_sequences_interp, 75, axis=0) if has_gfr_data else np.full(n_time_points, np.nan)
        gfr_cohort_p10 = np.nanpercentile(gfr_sequences_interp, 10, axis=0) if has_gfr_data else np.full(n_time_points, np.nan)
        gfr_cohort_p90 = np.nanpercentile(gfr_sequences_interp, 90, axis=0) if has_gfr_data else np.full(n_time_points, np.nan)
        
        # LSTM reconstruction
        kre_lstm_trajectory = None
        gfr_lstm_trajectory = None
        
        if self.lstm_model_kre is not None and len(kre_sequences_interp) > 0:
            try:
                kre_sequences_norm = (kre_sequences_interp - self.scaler_kre_mean) / self.scaler_kre_std
                X_kre = kre_sequences_norm.reshape(-1, n_time_points, 1)
                kre_lstm_pred = self.lstm_model_kre.predict(X_kre, verbose=0)
                kre_lstm_mean = np.mean(kre_lstm_pred.reshape(-1, n_time_points), axis=0)
                kre_lstm_trajectory = kre_lstm_mean * self.scaler_kre_std + self.scaler_kre_mean
            except Exception as e:
                print(f"   ⚠️ KRE LSTM prediction failed: {e}")
                kre_lstm_trajectory = kre_cohort_median
        
        if kre_lstm_trajectory is None:
            kre_lstm_trajectory = kre_cohort_median
        
        if self.lstm_model_gfr is not None and has_gfr_data and len(gfr_sequences_interp) > 0:
            try:
                gfr_sequences_norm = (gfr_sequences_interp - self.scaler_gfr_mean) / self.scaler_gfr_std
                X_gfr = gfr_sequences_norm.reshape(-1, n_time_points, 1)
                gfr_lstm_pred = self.lstm_model_gfr.predict(X_gfr, verbose=0)
                gfr_lstm_mean = np.mean(gfr_lstm_pred.reshape(-1, n_time_points), axis=0)
                gfr_lstm_trajectory = gfr_lstm_mean * self.scaler_gfr_std + self.scaler_gfr_mean
            except Exception as e:
                print(f"   ⚠️ GFR LSTM prediction failed: {e}")
                gfr_lstm_trajectory = gfr_cohort_median if has_gfr_data else None
        
        if gfr_lstm_trajectory is None:
            # Use cohort median if available, otherwise None
            gfr_lstm_trajectory = gfr_cohort_median if has_gfr_data and not np.all(np.isnan(gfr_cohort_median)) else None
        
        # Autoencoder reconstruction error
        kre_ae_error = None
        gfr_ae_error = None
        
        if self.autoencoder_kre is not None and len(kre_sequences_interp) > 0:
            try:
                kre_sequences_norm = (kre_sequences_interp - self.scaler_kre_mean) / self.scaler_kre_std
                kre_ae_pred = self.autoencoder_kre.predict(kre_sequences_norm, verbose=0)
                kre_ae_errors = np.abs(kre_sequences_norm - kre_ae_pred)
                kre_ae_error = np.mean(kre_ae_errors, axis=0) * self.scaler_kre_std
            except Exception as e:
                print(f"   ⚠️ KRE autoencoder prediction failed: {e}")
                kre_ae_error = kre_cohort_std
        
        if kre_ae_error is None:
            kre_ae_error = kre_cohort_std
        
        if self.autoencoder_gfr is not None and has_gfr_data and len(gfr_sequences_interp) > 0:
            try:
                gfr_sequences_norm = (gfr_sequences_interp - self.scaler_gfr_mean) / self.scaler_gfr_std
                gfr_ae_pred = self.autoencoder_gfr.predict(gfr_sequences_norm, verbose=0)
                gfr_ae_errors = np.abs(gfr_sequences_norm - gfr_ae_pred)
                gfr_ae_error = np.mean(gfr_ae_errors, axis=0) * self.scaler_gfr_std
            except Exception as e:
                print(f"   ⚠️ GFR autoencoder prediction failed: {e}")
                gfr_ae_error = gfr_cohort_std if has_gfr_data else None
        else:
            gfr_ae_error = gfr_cohort_std if has_gfr_data else None
        
        # Build trajectory data
        trajectory_data = []
        for i, time_key in enumerate(time_keys):
            info = get_unified_time_info(time_key)
            trajectory_data.append({
                "time_key": time_key,
                "time_order": info["order"],
                "pseudo_days": info["pseudo_days"],
                "expected_kre": round(float(kre_lstm_trajectory[i]), 2) if kre_lstm_trajectory is not None and not np.isnan(kre_lstm_trajectory[i]) else None,
                "expected_gfr": round(float(gfr_lstm_trajectory[i]), 1) if gfr_lstm_trajectory is not None and not np.isnan(gfr_lstm_trajectory[i]) else None,
                "cohort_kre_mean": round(float(kre_cohort_mean[i]), 2),
                "cohort_kre_median": round(float(kre_cohort_median[i]), 2),
                "cohort_gfr_mean": round(float(gfr_cohort_mean[i]), 1),
                "cohort_gfr_median": round(float(gfr_cohort_median[i]), 1),
                "bound_kre_lower": round(float(max(0, kre_cohort_p10[i])), 2),
                "bound_kre_upper": round(float(kre_cohort_p90[i]), 2),
                "bound_gfr_lower": round(float(max(0, gfr_cohort_p10[i])), 1),
                "bound_gfr_upper": round(float(gfr_cohort_p90[i]), 1),
                "iqr_kre_lower": round(float(max(0, kre_cohort_p25[i])), 2),
                "iqr_kre_upper": round(float(kre_cohort_p75[i]), 2),
                "iqr_gfr_lower": round(float(max(0, gfr_cohort_p25[i])), 1),
                "iqr_gfr_upper": round(float(gfr_cohort_p75[i]), 1),
                "ae_kre_error": round(float(kre_ae_error[i]), 2) if kre_ae_error is not None else None,
                "ae_gfr_error": round(float(gfr_ae_error[i]), 1) if gfr_ae_error is not None else None
            })
        
        result = {
            "metadata": {
                "type": "improved_cohort_trajectory_lab",
                "n_patients": len(kre_sequences),
                "n_time_points": n_time_points,
                "model": "LSTM + Autoencoder",
                "created_at": datetime.now().isoformat()
            },
            "trajectory": trajectory_data,
            "summary": {
                "initial_kre_median": round(float(kre_cohort_median[0]), 2) if len(kre_cohort_median) > 0 else None,
                "final_kre_median": round(float(kre_cohort_median[-1]), 2) if len(kre_cohort_median) > 0 else None,
                "initial_gfr_median": round(float(gfr_cohort_median[0]), 1) if len(gfr_cohort_median) > 0 else None,
                "final_gfr_median": round(float(gfr_cohort_median[-1]), 1) if len(gfr_cohort_median) > 0 else None
            }
        }
        
        return result


def analyze_improved_lab_cohort(lab_long: pd.DataFrame, 
                                improved_patients: List[str]) -> dict:
    """
    Main function to analyze improved LAB cohort and generate trajectory.
    """
    analyzer = LABCohortTrajectoryAnalyzer()
    
    # Fit models
    fit_result = analyzer.fit(lab_long, improved_patients, epochs=50)
    
    if "error" in fit_result:
        return fit_result
    
    # Generate trajectory (use improved_lab if available, otherwise fallback to improved_patients)
    # Get improved_lab from analyzer if fit was successful
    improved_lab_for_trajectory = improved_patients
    if "error" not in fit_result and hasattr(analyzer, '_last_improved_lab'):
        improved_lab_for_trajectory = analyzer._last_improved_lab
    trajectory = analyzer.generate_expected_trajectory(lab_long, improved_lab_for_trajectory)
    
    # Merge results
    trajectory["training"] = fit_result
    
    print(f"✅ LAB cohort trajectory generated: {fit_result['n_time_points']} time points")
    
    return trajectory


if __name__ == "__main__":
    from io_excel import load_all_data
    
    meta, kmr_long, lab_long, improved, raw = load_all_data()
    improved_patients = [p for p, v in improved.items() if v]
    
    result = analyze_improved_lab_cohort(lab_long, improved_patients)
    
    print("\nTrajectory sample:")
    for t in result["trajectory"][:5]:
        print(f"  {t['time_key']}: KRE={t['expected_kre']}, GFR={t['expected_gfr']}")
