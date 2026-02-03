"""
LAB Anomaly Detection - VAE for KRE/GFR anomaly scoring
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
from .time_mapping import UNIFIED_TIME_MAP


class LABAnomalyDetector:
    """VAE-based anomaly detection for KRE/GFR series"""
    
    def __init__(self, config: dict = None):
        self.config = config or ANOMALY_CONFIG
        self.reconstruction_errors: Dict[str, List[float]] = {}
        self.thresholds: Dict[str, float] = {}
        self.global_threshold_kre: float = 0.0
        self.global_threshold_gfr: float = 0.0
    
    def _build_vae(self, input_dim: int, latent_dim: int = 4) -> tuple:
        """Build simple VAE encoder/decoder"""
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
        autoencoder = Model(inputs, decoded, name="lab_autoencoder")
        autoencoder.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        
        # Encoder model
        encoder = Model(inputs, encoded, name="lab_encoder")
        
        return autoencoder, encoder, None
    
    def _build_multi_vae(self, input_dim: int, latent_dim: int = 6) -> tuple:
        """Build multi-output VAE for KRE+GFR together"""
        inputs = layers.Input(shape=(input_dim,))
        
        # Encoder
        x = layers.Dense(32, activation="relu")(inputs)
        x = layers.Dense(16, activation="relu")(x)
        encoded = layers.Dense(latent_dim, activation="relu")(x)
        
        # Decoder
        x = layers.Dense(16, activation="relu")(encoded)
        x = layers.Dense(32, activation="relu")(x)
        
        # Separate outputs for KRE and GFR
        kre_decoded = layers.Dense(input_dim // 2, name="kre_output")(x)
        gfr_decoded = layers.Dense(input_dim // 2, name="gfr_output")(x)
        
        # Combine outputs
        decoded = layers.Concatenate()([kre_decoded, gfr_decoded])
        
        autoencoder = Model(inputs, decoded, name="lab_multi_autoencoder")
        autoencoder.compile(
            optimizer=keras.optimizers.Adam(0.001),
            loss="mse"
        )
        
        encoder = Model(inputs, encoded, name="lab_multi_encoder")
        
        return autoencoder, encoder, None
    
    def _prepare_windows(self, series: np.ndarray, window_size: int = 5) -> np.ndarray:
        """Prepare sliding windows from series"""
        if len(series) < window_size:
            pad_size = window_size - len(series)
            padding = np.full(pad_size, np.nanmean(series))
            series = np.concatenate([padding, series])
        
        windows = []
        for i in range(len(series) - window_size + 1):
            windows.append(series[i:i+window_size])
        
        return np.array(windows)
    
    def _prepare_multi_windows(self, kre_series: np.ndarray, gfr_series: np.ndarray, 
                               window_size: int = 5) -> np.ndarray:
        """Prepare multi-variable windows"""
        # Pad if needed
        max_len = max(len(kre_series), len(gfr_series))
        if len(kre_series) < max_len:
            kre_series = np.pad(kre_series, (0, max_len - len(kre_series)), 
                               constant_values=np.nanmean(kre_series))
        if len(gfr_series) < max_len:
            gfr_series = np.pad(gfr_series, (0, max_len - len(gfr_series)), 
                               constant_values=np.nanmean(gfr_series))
        
        windows = []
        for i in range(max_len - window_size + 1):
            kre_window = kre_series[i:i+window_size]
            gfr_window = gfr_series[i:i+window_size]
            combined = np.concatenate([kre_window, gfr_window])
            windows.append(combined)
        
        return np.array(windows)
    
    def fit_global(self, lab_long: pd.DataFrame) -> None:
        """Fit global VAE on all patient data"""
        if not HAS_TF:
            self._fit_simple_threshold(lab_long)
            return
        
        print("🔍 Training global LAB anomaly detector...")
        
        # Collect windows for KRE and GFR
        all_kre_windows = []
        all_gfr_windows = []
        all_multi_windows = []
        window_size = 5
        
        for patient in lab_long["patient_code"].unique():
            patient_df = lab_long[lab_long["patient_code"] == patient].sort_values("time_order")
            
            # Extract KRE and GFR values
            kre_values = patient_df["kre"].dropna().values
            gfr_values = patient_df["gfr"].dropna().values
            
            kre_values = np.array([v for v in kre_values if v is not None and not np.isnan(v)])
            gfr_values = np.array([v for v in gfr_values if v is not None and not np.isnan(v)])
            
            # Single-variable windows
            if len(kre_values) >= 3:
                mean_val = float(np.nanmean(kre_values))
                std_val = float(np.nanstd(kre_values)) + 1e-6
                normalized = (kre_values - mean_val) / std_val
                normalized = np.nan_to_num(normalized, nan=0.0)
                windows = self._prepare_windows(normalized, window_size)
                for w in windows:
                    if not np.any(np.isnan(w)):
                        all_kre_windows.append(w.astype(np.float32))
            
            if len(gfr_values) >= 3:
                mean_val = float(np.nanmean(gfr_values))
                std_val = float(np.nanstd(gfr_values)) + 1e-6
                normalized = (gfr_values - mean_val) / std_val
                normalized = np.nan_to_num(normalized, nan=0.0)
                windows = self._prepare_windows(normalized, window_size)
                for w in windows:
                    if not np.any(np.isnan(w)):
                        all_gfr_windows.append(w.astype(np.float32))
            
            # Multi-variable windows (both KRE and GFR)
            if len(kre_values) >= 3 and len(gfr_values) >= 3:
                kre_mean = float(np.nanmean(kre_values))
                kre_std = float(np.nanstd(kre_values)) + 1e-6
                gfr_mean = float(np.nanmean(gfr_values))
                gfr_std = float(np.nanstd(gfr_values)) + 1e-6
                
                kre_norm = np.nan_to_num((kre_values - kre_mean) / kre_std, nan=0.0)
                gfr_norm = np.nan_to_num((gfr_values - gfr_mean) / gfr_std, nan=0.0)
                
                windows = self._prepare_multi_windows(kre_norm, gfr_norm, window_size)
                for w in windows:
                    if not np.any(np.isnan(w)):
                        all_multi_windows.append(w.astype(np.float32))
        
        # Train KRE VAE
        if len(all_kre_windows) >= 10:
            try:
                all_kre_windows = np.array(all_kre_windows, dtype=np.float32)
                all_kre_windows = np.nan_to_num(all_kre_windows, nan=0.0, posinf=0.0, neginf=0.0)
                
                vae_kre, encoder_kre, _ = self._build_vae(window_size)
                vae_kre.fit(all_kre_windows, epochs=30, batch_size=min(32, len(all_kre_windows)), verbose=0)
                
                reconstructed = vae_kre.predict(all_kre_windows, verbose=0)
                errors = np.mean((all_kre_windows - reconstructed) ** 2, axis=1)
                
                q1, q3 = np.percentile(errors, [25, 75])
                iqr = q3 - q1
                k = self.config.get("iqr_multiplier", 1.5)
                self.global_threshold_kre = q3 + k * iqr
                
                self.vae_kre = vae_kre
                self.encoder_kre = encoder_kre
                print(f"✅ KRE anomaly detector trained. Threshold: {self.global_threshold_kre:.4f}")
            except Exception as e:
                print(f"⚠️ KRE VAE training failed: {e}")
                self._fit_simple_threshold_kre(lab_long)
        else:
            self._fit_simple_threshold_kre(lab_long)
        
        # Train GFR VAE
        if len(all_gfr_windows) >= 10:
            try:
                all_gfr_windows = np.array(all_gfr_windows, dtype=np.float32)
                all_gfr_windows = np.nan_to_num(all_gfr_windows, nan=0.0, posinf=0.0, neginf=0.0)
                
                vae_gfr, encoder_gfr, _ = self._build_vae(window_size)
                vae_gfr.fit(all_gfr_windows, epochs=30, batch_size=min(32, len(all_gfr_windows)), verbose=0)
                
                reconstructed = vae_gfr.predict(all_gfr_windows, verbose=0)
                errors = np.mean((all_gfr_windows - reconstructed) ** 2, axis=1)
                
                q1, q3 = np.percentile(errors, [25, 75])
                iqr = q3 - q1
                k = self.config.get("iqr_multiplier", 1.5)
                self.global_threshold_gfr = q3 + k * iqr
                
                self.vae_gfr = vae_gfr
                self.encoder_gfr = encoder_gfr
                print(f"✅ GFR anomaly detector trained. Threshold: {self.global_threshold_gfr:.4f}")
            except Exception as e:
                print(f"⚠️ GFR VAE training failed: {e}")
                self._fit_simple_threshold_gfr(lab_long)
        else:
            self._fit_simple_threshold_gfr(lab_long)
        
        # Train multi-output VAE
        if len(all_multi_windows) >= 10:
            try:
                all_multi_windows = np.array(all_multi_windows, dtype=np.float32)
                all_multi_windows = np.nan_to_num(all_multi_windows, nan=0.0, posinf=0.0, neginf=0.0)
                
                vae_multi, encoder_multi, _ = self._build_multi_vae(window_size * 2)
                vae_multi.fit(all_multi_windows, epochs=30, batch_size=min(32, len(all_multi_windows)), verbose=0)
                
                self.vae_multi = vae_multi
                self.encoder_multi = encoder_multi
                print("✅ Multi-output LAB anomaly detector trained")
            except Exception as e:
                print(f"⚠️ Multi-output VAE training failed: {e}")
    
    def _fit_simple_threshold_kre(self, lab_long: pd.DataFrame) -> None:
        """Simple threshold for KRE"""
        all_kre = lab_long["kre"].dropna().values
        if len(all_kre) > 0:
            q1, q3 = np.percentile(all_kre, [25, 75])
            iqr = q3 - q1
            k = self.config.get("iqr_multiplier", 1.5)
            self.global_threshold_kre = q3 + k * iqr
            self.use_simple_kre = True
            print(f"✅ Simple KRE threshold set: {self.global_threshold_kre:.4f}")
    
    def _fit_simple_threshold_gfr(self, lab_long: pd.DataFrame) -> None:
        """Simple threshold for GFR"""
        all_gfr = lab_long["gfr"].dropna().values
        if len(all_gfr) > 0:
            q1, q3 = np.percentile(all_gfr, [25, 75])
            iqr = q3 - q1
            k = self.config.get("iqr_multiplier", 1.5)
            self.global_threshold_gfr = q3 + k * iqr
            self.use_simple_gfr = True
            print(f"✅ Simple GFR threshold set: {self.global_threshold_gfr:.4f}")
    
    def _fit_simple_threshold(self, lab_long: pd.DataFrame) -> None:
        """Simple thresholds for both"""
        self._fit_simple_threshold_kre(lab_long)
        self._fit_simple_threshold_gfr(lab_long)
    
    def score_patient(self, lab_df: pd.DataFrame) -> List[dict]:
        """Calculate anomaly scores for a patient's LAB series"""
        df = lab_df.sort_values("time_order").copy()
        kre_values = df["kre"].dropna().values
        gfr_values = df["gfr"].dropna().values
        
        n_points = len(df)
        
        # Simple approach if no TF or too few points
        if not HAS_TF or getattr(self, "use_simple_kre", False) or len(kre_values) < 3:
            kre_scores = self._simple_scoring(kre_values, "kre")
        else:
            kre_scores = self._vae_scoring(kre_values, "kre")
        
        if not HAS_TF or getattr(self, "use_simple_gfr", False) or len(gfr_values) < 3:
            gfr_scores = self._simple_scoring(gfr_values, "gfr")
        else:
            gfr_scores = self._vae_scoring(gfr_values, "gfr")
        
        # Combine scores by time point
        scores = []
        kre_idx = 0
        gfr_idx = 0
        
        for _, row in df.iterrows():
            kre_score = None
            gfr_score = None
            
            if not pd.isna(row["kre"]) and kre_idx < len(kre_scores):
                kre_score = kre_scores[kre_idx]
                kre_idx += 1
            
            if not pd.isna(row["gfr"]) and gfr_idx < len(gfr_scores):
                gfr_score = gfr_scores[gfr_idx]
                gfr_idx += 1
            
            scores.append({
                "kre_anomaly_score": kre_score["score"] if kre_score else None,
                "kre_anomaly_flag": kre_score["flag"] if kre_score else False,
                "gfr_anomaly_score": gfr_score["score"] if gfr_score else None,
                "gfr_anomaly_flag": gfr_score["flag"] if gfr_score else False
            })
        
        return scores
    
    def _vae_scoring(self, values: np.ndarray, metric: str) -> List[dict]:
        """VAE-based anomaly scoring"""
        mean_val = values.mean()
        std_val = values.std() + 1e-6
        normalized = (values - mean_val) / std_val
        
        window_size = 5
        vae = getattr(self, f"vae_{metric}", None)
        threshold = getattr(self, f"global_threshold_{metric}", 1.0)
        
        if vae is None:
            return self._simple_scoring(values, metric)
        
        scores = []
        for i in range(len(values)):
            start_idx = max(0, i - window_size + 1)
            window = normalized[start_idx:i+1]
            
            if len(window) < window_size:
                pad = np.full(window_size - len(window), window.mean())
                window = np.concatenate([pad, window])
            
            window = window.reshape(1, -1)
            
            try:
                reconstructed = vae.predict(window, verbose=0)
                error = float(np.mean((window - reconstructed) ** 2))
            except:
                error = 0.0
            
            score = min(100, (error / (threshold + 1e-6)) * 50)
            flag = error > threshold
            
            scores.append({"score": round(score, 2), "flag": flag})
        
        return scores
    
    def _simple_scoring(self, values: np.ndarray, metric: str) -> List[dict]:
        """Simple z-score based anomaly scoring"""
        if len(values) == 0:
            return []
        
        mean_val = values.mean()
        std_val = values.std() + 1e-6
        
        scores = []
        for val in values:
            z = abs(val - mean_val) / std_val
            score = min(100, z * 20)
            flag = z > 2.5
            
            scores.append({"score": round(float(score), 2), "flag": bool(flag)})
        
        return scores
    
    def bulk_score(self, lab_long: pd.DataFrame) -> Dict[str, List[dict]]:
        """Score all patients"""
        results = {}
        patients = lab_long["patient_code"].unique()
        
        print(f"🔍 Scoring LAB anomalies for {len(patients)} patients...")
        
        for patient in patients:
            patient_df = lab_long[lab_long["patient_code"] == patient]
            results[patient] = self.score_patient(patient_df)
        
        print("✅ LAB anomaly scoring complete")
        return results


if __name__ == "__main__":
    from io_excel import load_all_data
    
    meta, kmr_long, lab_long, improved, raw = load_all_data()
    
    detector = LABAnomalyDetector()
    detector.fit_global(lab_long)
    scores = detector.bulk_score(lab_long)
    
    print("\nSample scores:")
    sample = list(scores.keys())[0]
    print(f"Patient {sample}: {scores[sample][:3]}")
