"""
Cohort Trajectory - LSTM/VAE based expected trajectory for improved patients
Calculates the "ideal" KMR trajectory from patients who completed 9+ months
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime

import tensorflow as tf
from tensorflow import keras
from keras import layers, Model

from .time_mapping import KMR_TIME_MAP, get_kmr_time_info


class CohortTrajectoryAnalyzer:
    """
    Analyzes improved cohort to generate expected KMR trajectory.
    Uses LSTM for sequence modeling and autoencoder for confidence bounds.
    """
    
    def __init__(self):
        self.lstm_model = None
        self.autoencoder = None
        self.scaler_mean = 0
        self.scaler_std = 1
        
    def prepare_cohort_sequences(self, kmr_long: pd.DataFrame, 
                                  improved_patients: List[str]) -> Tuple[np.ndarray, List[str]]:
        """
        Prepare cohort data as sequences for LSTM training.
        Each patient becomes one sequence.
        """
        cohort_df = kmr_long[kmr_long["patient_code"].isin(improved_patients)].copy()
        
        # Get all time points in order
        time_keys = sorted(KMR_TIME_MAP.keys(), key=lambda x: KMR_TIME_MAP[x]["order"])
        n_time_points = len(time_keys)
        
        sequences = []
        patient_ids = []
        
        for patient in improved_patients:
            patient_data = cohort_df[cohort_df["patient_code"] == patient]
            
            # Create sequence with NaN for missing points
            seq = np.full(n_time_points, np.nan)
            for _, row in patient_data.iterrows():
                if row["time_key"] in time_keys:
                    idx = time_keys.index(row["time_key"])
                    seq[idx] = row["kmr"]
            
            # Only include if patient has at least 5 measurements
            if np.sum(~np.isnan(seq)) >= 5:
                sequences.append(seq)
                patient_ids.append(patient)
        
        return np.array(sequences), time_keys
    
    def interpolate_sequences(self, sequences: np.ndarray) -> np.ndarray:
        """Interpolate missing values in sequences using linear interpolation"""
        interpolated = sequences.copy()
        
        for i in range(len(sequences)):
            seq = sequences[i]
            # Find valid indices
            valid_idx = np.where(~np.isnan(seq))[0]
            
            if len(valid_idx) < 2:
                continue
                
            # Linear interpolation
            for j in range(len(seq)):
                if np.isnan(seq[j]):
                    # Find nearest valid points
                    left = valid_idx[valid_idx < j]
                    right = valid_idx[valid_idx > j]
                    
                    if len(left) > 0 and len(right) > 0:
                        # Interpolate
                        l_idx, r_idx = left[-1], right[0]
                        ratio = (j - l_idx) / (r_idx - l_idx)
                        interpolated[i, j] = seq[l_idx] + ratio * (seq[r_idx] - seq[l_idx])
                    elif len(left) > 0:
                        # Extrapolate forward (use last value)
                        interpolated[i, j] = seq[left[-1]]
                    elif len(right) > 0:
                        # Extrapolate backward (use first value)
                        interpolated[i, j] = seq[right[0]]
        
        return interpolated
    
    def build_lstm_model(self, n_time_points: int) -> Any:
        """Build LSTM model for sequence prediction"""
        inputs = layers.Input(shape=(n_time_points, 1))
        
        # Encoder
        x = layers.LSTM(32, return_sequences=True)(inputs)
        x = layers.Dropout(0.2)(x)
        x = layers.LSTM(16, return_sequences=True)(x)
        
        # Decoder
        x = layers.LSTM(16, return_sequences=True)(x)
        x = layers.LSTM(32, return_sequences=True)(x)
        outputs = layers.TimeDistributed(layers.Dense(1))(x)
        
        model = Model(inputs, outputs, name="cohort_lstm")
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
        
        autoencoder = Model(inputs, decoded, name="trajectory_ae")
        autoencoder.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        
        encoder = Model(inputs, encoded, name="trajectory_encoder")
        
        return autoencoder, encoder
    
    def fit(self, kmr_long: pd.DataFrame, improved_patients: List[str], 
            epochs: int = 100) -> dict:
        """
        Fit LSTM and autoencoder models on improved cohort data.
        Returns training statistics.
        """
        print(f"🧬 Analyzing cohort trajectory for {len(improved_patients)} improved patients...")
        
        # Prepare sequences
        sequences, time_keys = self.prepare_cohort_sequences(kmr_long, improved_patients)
        
        if len(sequences) < 3:
            return {"error": "insufficient_patients", "n_patients": len(sequences)}
        
        # Interpolate missing values
        sequences_interp = self.interpolate_sequences(sequences)
        
        # Normalize
        self.scaler_mean = np.nanmean(sequences_interp)
        self.scaler_std = np.nanstd(sequences_interp)
        if self.scaler_std < 0.001:
            self.scaler_std = 1.0
        
        sequences_norm = (sequences_interp - self.scaler_mean) / self.scaler_std
        
        n_time_points = len(time_keys)
        
        # Train LSTM
        print("   Training LSTM sequence model...")
        self.lstm_model = self.build_lstm_model(n_time_points)
        X_lstm = sequences_norm.reshape(-1, n_time_points, 1)
        
        self.lstm_model.fit(
            X_lstm, X_lstm,
            epochs=epochs,
            batch_size=max(1, len(sequences) // 4),
            verbose=0
        )
        
        # Train Autoencoder
        print("   Training autoencoder for bounds...")
        self.autoencoder, self.encoder = self.build_autoencoder(n_time_points)
        
        self.autoencoder.fit(
            sequences_norm, sequences_norm,
            epochs=epochs,
            batch_size=max(1, len(sequences) // 4),
            verbose=0
        )
        
        return {
            "n_patients": len(sequences),
            "n_time_points": n_time_points,
            "time_keys": time_keys,
            "scaler_mean": float(self.scaler_mean),
            "scaler_std": float(self.scaler_std)
        }
    
    def generate_expected_trajectory(self, kmr_long: pd.DataFrame,
                                      improved_patients: List[str]) -> dict:
        """
        Generate expected trajectory with confidence bounds.
        """
        sequences, time_keys = self.prepare_cohort_sequences(kmr_long, improved_patients)
        sequences_interp = self.interpolate_sequences(sequences)
        
        n_time_points = len(time_keys)
        
        # Calculate cohort statistics at each time point
        cohort_mean = np.nanmean(sequences_interp, axis=0)
        cohort_median = np.nanmedian(sequences_interp, axis=0)
        cohort_std = np.nanstd(sequences_interp, axis=0)
        cohort_p25 = np.nanpercentile(sequences_interp, 25, axis=0)
        cohort_p75 = np.nanpercentile(sequences_interp, 75, axis=0)
        cohort_p10 = np.nanpercentile(sequences_interp, 10, axis=0)
        cohort_p90 = np.nanpercentile(sequences_interp, 90, axis=0)
        
        # LSTM reconstruction (represents "expected" trajectory)
        if self.lstm_model is not None:
            sequences_norm = (sequences_interp - self.scaler_mean) / self.scaler_std
            X_lstm = sequences_norm.reshape(-1, n_time_points, 1)
            lstm_pred = self.lstm_model.predict(X_lstm, verbose=0)
            lstm_mean = np.mean(lstm_pred.reshape(-1, n_time_points), axis=0)
            lstm_trajectory = lstm_mean * self.scaler_std + self.scaler_mean
        else:
            lstm_trajectory = cohort_median
        
        # Autoencoder reconstruction error for confidence bounds
        if self.autoencoder is not None:
            sequences_norm = (sequences_interp - self.scaler_mean) / self.scaler_std
            ae_pred = self.autoencoder.predict(sequences_norm, verbose=0)
            ae_errors = np.abs(sequences_norm - ae_pred)
            ae_mean_error = np.mean(ae_errors, axis=0) * self.scaler_std
        else:
            ae_mean_error = cohort_std
        
        # Build trajectory data
        trajectory_data = []
        for i, time_key in enumerate(time_keys):
            info = get_kmr_time_info(time_key)
            trajectory_data.append({
                "time_key": time_key,
                "time_order": info["order"],
                "pseudo_days": info["pseudo_days"],
                "expected_kmr": round(float(lstm_trajectory[i]), 4),
                "cohort_mean": round(float(cohort_mean[i]), 4),
                "cohort_median": round(float(cohort_median[i]), 4),
                "cohort_std": round(float(cohort_std[i]), 4),
                "bound_lower": round(float(max(0, cohort_p10[i])), 4),
                "bound_upper": round(float(cohort_p90[i]), 4),
                "iqr_lower": round(float(max(0, cohort_p25[i])), 4),
                "iqr_upper": round(float(cohort_p75[i]), 4),
                "ae_error": round(float(ae_mean_error[i]), 4)
            })
        
        result = {
            "metadata": {
                "type": "improved_cohort_trajectory",
                "n_patients": len(sequences),
                "n_time_points": n_time_points,
                "model": "LSTM + Autoencoder",
                "created_at": datetime.now().isoformat()
            },
            "trajectory": trajectory_data,
            "summary": {
                "initial_kmr_median": round(float(cohort_median[0]), 4),
                "final_kmr_median": round(float(cohort_median[-1]), 4),
                "reduction_percent": round(float((1 - cohort_median[-1] / cohort_median[0]) * 100), 2) if cohort_median[0] > 0 else 0,
                "time_to_stable": self._calculate_time_to_stable(cohort_median, time_keys)
            }
        }
        
        return result
    
    def _calculate_time_to_stable(self, trajectory: np.ndarray, time_keys: List[str], 
                                   threshold: float = 0.5) -> Optional[str]:
        """Find first time point where KMR goes below threshold and stays low"""
        for i, val in enumerate(trajectory):
            if val < threshold:
                # Check if it stays low
                if all(trajectory[j] < threshold * 2 for j in range(i, min(i + 3, len(trajectory)))):
                    return time_keys[i]
        return None


def analyze_improved_cohort(kmr_long: pd.DataFrame, 
                            improved_patients: List[str]) -> dict:
    """
    Main function to analyze improved cohort and generate trajectory.
    """
    analyzer = CohortTrajectoryAnalyzer()
    
    # Fit models
    fit_result = analyzer.fit(kmr_long, improved_patients, epochs=50)
    
    if "error" in fit_result:
        return fit_result
    
    # Generate trajectory
    trajectory = analyzer.generate_expected_trajectory(kmr_long, improved_patients)
    
    # Merge results
    trajectory["training"] = fit_result
    
    print(f"✅ Cohort trajectory generated: {fit_result['n_time_points']} time points")
    
    return trajectory


if __name__ == "__main__":
    from io_excel import load_all_data
    
    meta, kmr_long, lab_long, improved, raw = load_all_data()
    improved_patients = [p for p, v in improved.items() if v]
    
    result = analyze_improved_cohort(kmr_long, improved_patients)
    
    print("\nTrajectory sample:")
    for t in result["trajectory"][:5]:
        print(f"  {t['time_key']}: expected={t['expected_kmr']:.4f}, bounds=[{t['bound_lower']:.4f}, {t['bound_upper']:.4f}]")
    
    print(f"\nSummary: {result['summary']}")
