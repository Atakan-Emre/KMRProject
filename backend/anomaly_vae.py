"""
Anomaly Detection - Conditional VAE for KMR anomaly scoring
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
import warnings
warnings.filterwarnings('ignore')

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model
    HAS_TF = True
except ImportError:
    HAS_TF = False

from .config import ANOMALY_CONFIG


class KMRAnomalyDetector:
    """VAE-based anomaly detection for KMR series"""
    
    def __init__(self, config: dict = None):
        self.config = config or ANOMALY_CONFIG
        self.reconstruction_errors: Dict[str, List[float]] = {}
        self.thresholds: Dict[str, float] = {}
        self.global_threshold: float = 0.0
    
    def _build_vae(self, input_dim: int, latent_dim: int = 4) -> tuple:
        """Build simple VAE encoder/decoder using Keras 3 compatible approach"""
        # Simple autoencoder instead of VAE for compatibility
        inputs = layers.Input(shape=(input_dim,))
        
        # Encoder
        x = layers.Dense(16, activation="relu")(inputs)
        x = layers.Dense(8, activation="relu")(x)
        encoded = layers.Dense(latent_dim, activation="relu")(x)
        
        # Decoder
        x = layers.Dense(8, activation="relu")(encoded)
        x = layers.Dense(16, activation="relu")(x)
        decoded = layers.Dense(input_dim)(x)
        
        # Autoencoder model
        autoencoder = Model(inputs, decoded, name="autoencoder")
        autoencoder.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        
        # Encoder model for later use
        encoder = Model(inputs, encoded, name="encoder")
        
        return autoencoder, encoder, None
    
    def _prepare_windows(self, kmr_series: np.ndarray, window_size: int = 5) -> np.ndarray:
        """Prepare sliding windows from series"""
        if len(kmr_series) < window_size:
            # Pad with mean if too short
            pad_size = window_size - len(kmr_series)
            padding = np.full(pad_size, kmr_series.mean())
            kmr_series = np.concatenate([padding, kmr_series])
        
        windows = []
        for i in range(len(kmr_series) - window_size + 1):
            windows.append(kmr_series[i:i+window_size])
        
        return np.array(windows)
    
    def fit_global(self, kmr_long: pd.DataFrame) -> None:
        """Fit global VAE on all patient data to establish baseline"""
        if not HAS_TF:
            self._fit_simple_threshold(kmr_long)
            return
        
        print("🔍 Training global anomaly detector...")
        
        # Collect all windows
        all_windows = []
        window_size = 5
        
        for patient in kmr_long["patient_code"].unique():
            patient_df = kmr_long[kmr_long["patient_code"] == patient].sort_values("time_order")
            kmr_values = patient_df["kmr"].dropna().values
            
            # Filter out None/NaN values
            kmr_values = np.array([v for v in kmr_values if v is not None and not np.isnan(v)])
            
            if len(kmr_values) >= 3:
                # Normalize per patient
                mean_val = float(np.nanmean(kmr_values))
                std_val = float(np.nanstd(kmr_values)) + 1e-6
                normalized = (kmr_values - mean_val) / std_val
                
                # Ensure no NaN in normalized
                normalized = np.nan_to_num(normalized, nan=0.0)
                
                windows = self._prepare_windows(normalized, window_size)
                # Filter out any windows with NaN
                for w in windows:
                    if not np.any(np.isnan(w)) and not np.any(w is None):
                        all_windows.append(w.astype(np.float32))
        
        if len(all_windows) < 10:
            self._fit_simple_threshold(kmr_long)
            return
        
        all_windows = np.array(all_windows, dtype=np.float32)
        all_windows = np.nan_to_num(all_windows, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Train VAE
        vae, encoder, decoder = self._build_vae(window_size)
        
        try:
            vae.fit(all_windows, epochs=30, batch_size=min(32, len(all_windows)), verbose=0)
        except Exception as e:
            print(f"⚠️ VAE training failed: {e}")
            self._fit_simple_threshold(kmr_long)
            return
        
        # Calculate reconstruction errors
        reconstructed = vae.predict(all_windows, verbose=0)
        errors = np.mean((all_windows - reconstructed) ** 2, axis=1)
        
        # Set global threshold (median + k*IQR)
        q1, q3 = np.percentile(errors, [25, 75])
        iqr = q3 - q1
        k = self.config.get("iqr_multiplier", 1.5)
        self.global_threshold = q3 + k * iqr
        
        self.vae = vae
        self.encoder = encoder
        self.window_size = window_size
        
        print(f"✅ Anomaly detector trained. Threshold: {self.global_threshold:.4f}")
    
    def _fit_simple_threshold(self, kmr_long: pd.DataFrame) -> None:
        """Simple threshold based on IQR of all KMR values"""
        all_kmr = kmr_long["kmr"].values
        q1, q3 = np.percentile(all_kmr, [25, 75])
        iqr = q3 - q1
        k = self.config.get("iqr_multiplier", 1.5)
        
        self.global_threshold = q3 + k * iqr
        self.use_simple = True
        print(f"✅ Simple threshold set: {self.global_threshold:.4f}")
    
    def score_patient(self, kmr_df: pd.DataFrame) -> List[dict]:
        """Calculate anomaly scores for a patient's KMR series"""
        df = kmr_df.sort_values("time_order").copy()
        kmr_values = df["kmr"].values
        n_points = len(kmr_values)
        
        # Simple approach if no TF or too few points
        if not HAS_TF or getattr(self, "use_simple", False) or n_points < 3:
            return self._simple_scoring(kmr_values)
        
        # Normalize
        mean_val = kmr_values.mean()
        std_val = kmr_values.std() + 1e-6
        normalized = (kmr_values - mean_val) / std_val
        
        # Prepare windows
        window_size = getattr(self, "window_size", 5)
        
        scores = []
        for i in range(n_points):
            # Get window ending at this point
            start_idx = max(0, i - window_size + 1)
            window = normalized[start_idx:i+1]
            
            if len(window) < window_size:
                # Pad
                pad = np.full(window_size - len(window), window.mean())
                window = np.concatenate([pad, window])
            
            window = window.reshape(1, -1)
            
            try:
                reconstructed = self.vae.predict(window, verbose=0)
                error = float(np.mean((window - reconstructed) ** 2))
            except:
                error = 0.0
            
            # Normalize score to 0-100
            score = min(100, (error / (self.global_threshold + 1e-6)) * 50)
            flag = error > self.global_threshold
            
            scores.append({
                "kmr_anomaly_score": round(score, 2),
                "kmr_anomaly_flag": flag
            })
        
        return scores
    
    def _simple_scoring(self, kmr_values: np.ndarray) -> List[dict]:
        """Simple z-score based anomaly scoring"""
        mean_val = kmr_values.mean()
        std_val = kmr_values.std() + 1e-6
        
        scores = []
        for val in kmr_values:
            z = abs(val - mean_val) / std_val
            score = min(100, z * 20)  # Scale z-score to 0-100
            flag = z > 2.5
            
            scores.append({
                "kmr_anomaly_score": round(float(score), 2),
                "kmr_anomaly_flag": bool(flag)
            })
        
        return scores
    
    def bulk_score(self, kmr_long: pd.DataFrame) -> Dict[str, List[dict]]:
        """Score all patients"""
        results = {}
        patients = kmr_long["patient_code"].unique()
        
        print(f"🔍 Scoring anomalies for {len(patients)} patients...")
        
        for patient in patients:
            patient_df = kmr_long[kmr_long["patient_code"] == patient]
            results[patient] = self.score_patient(patient_df)
        
        print("✅ Anomaly scoring complete")
        return results


if __name__ == "__main__":
    from io_excel import load_all_data
    
    meta, kmr_long, lab_long, improved, raw = load_all_data()
    
    detector = KMRAnomalyDetector()
    detector.fit_global(kmr_long)
    scores = detector.bulk_score(kmr_long)
    
    print("\nSample scores:")
    sample = list(scores.keys())[0]
    print(f"Patient {sample}: {scores[sample][:3]}")
