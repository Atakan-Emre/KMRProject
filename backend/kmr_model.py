"""
KMR Model - LSTM prediction for KMR time series
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, TYPE_CHECKING, Any
import warnings
warnings.filterwarnings('ignore')

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    HAS_TF = True
except ImportError:
    HAS_TF = False
    Model = Any  # Type hint fallback when TensorFlow is not available
    print("⚠️ TensorFlow not available, using simple prediction fallback")

from .config import MODEL_CONFIG
from .time_mapping import UNIFIED_TIME_MAP


class KMRPredictor:
    """LSTM-based KMR prediction model"""
    
    def __init__(self, config: dict = None):
        self.config = config or MODEL_CONFIG
        self.models: Dict[str, Any] = {}  # Model type when TF available
        self.scalers: Dict[str, dict] = {}
    
    def _determine_complexity(self, n_points: int) -> str:
        """Determine model complexity based on data points"""
        if n_points < self.config["complexity_thresholds"]["simple"]:
            return "simple"
        elif n_points < self.config["complexity_thresholds"]["medium"]:
            return "medium"
        return "complex"
    
    def _calculate_seq_len(self, n_points: int) -> int:
        """Calculate adaptive sequence length"""
        seq_len = max(self.config["seq_len_min"], round(n_points / 3))
        return min(seq_len, self.config["seq_len_max"])

    @staticmethod
    def _sanitize_prediction(pred: float, pred_lo: float, pred_hi: float,
                             lower: float = 0.0, upper: float = 100.0) -> Tuple[float, float, float]:
        """Clamp predictions to physiological bounds and keep lo <= pred <= hi."""
        pred = float(np.clip(pred, lower, upper))
        pred_lo = float(np.clip(pred_lo, lower, upper))
        pred_hi = float(np.clip(pred_hi, lower, upper))
        lo, hi = sorted((pred_lo, pred_hi))
        pred = float(np.clip(pred, lo, hi))
        return pred, lo, hi
    
    def _feature_engineering(self, kmr_series: pd.DataFrame) -> pd.DataFrame:
        """
        Feature engineering for KMR series
        
        Input: DataFrame with columns [time_order, pseudo_time_days, kmr]
        """
        df = kmr_series.sort_values("time_order").copy()
        
        # Baseline (first week values, ~48h proxy)
        early_mask = df["pseudo_time_days"] <= 7
        baseline = df.loc[early_mask, "kmr"].median() if early_mask.any() else df["kmr"].iloc[0]
        
        # Delta and ratio from baseline
        df["delta_from_baseline"] = df["kmr"] - baseline
        df["ratio_from_baseline"] = df["kmr"] / (baseline + 1e-6)
        
        # EWMA
        df["ewma"] = df["kmr"].ewm(span=3, min_periods=1).mean()
        
        # Rolling CV (coefficient of variation)
        rolling_std = df["kmr"].rolling(window=3, min_periods=1).std()
        rolling_mean = df["kmr"].rolling(window=3, min_periods=1).mean()
        df["rolling_cv"] = rolling_std / (rolling_mean + 1e-6)
        
        # Short-term slope (last 3 points)
        df["slope_short"] = 0.0
        if len(df) >= 3:
            for i in range(2, len(df)):
                y = df["kmr"].iloc[i-2:i+1].values
                x = np.arange(3)
                if len(y) == 3:
                    slope = np.polyfit(x, y, 1)[0]
                    df.iloc[i, df.columns.get_loc("slope_short")] = slope
        
        # Fill NaN
        df = df.fillna(0)
        
        return df
    
    def _build_simple_model(self, seq_len: int, n_features: int) -> Any:
        """Build simple GRU model for small datasets"""
        inputs = layers.Input(shape=(seq_len, n_features))
        x = layers.GRU(16, dropout=0.1)(inputs)
        x = layers.Dense(8, activation="relu")(x)
        outputs = layers.Dense(1)(x)
        
        model = Model(inputs, outputs)
        model.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        return model
    
    def _build_medium_model(self, seq_len: int, n_features: int) -> Any:
        """Build medium LSTM model"""
        inputs = layers.Input(shape=(seq_len, n_features))
        x = layers.LSTM(32, return_sequences=True, dropout=0.15)(inputs)
        x = layers.LSTM(16, dropout=0.15)(x)
        x = layers.Dense(8, activation="relu")(x)
        outputs = layers.Dense(1)(x)
        
        model = Model(inputs, outputs)
        model.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        return model
    
    def _build_complex_model(self, seq_len: int, n_features: int) -> Any:
        """Build complex LSTM model for larger datasets"""
        inputs = layers.Input(shape=(seq_len, n_features))
        x = layers.LSTM(64, return_sequences=True, dropout=0.2)(inputs)
        x = layers.LSTM(32, return_sequences=True, dropout=0.2)(x)
        x = layers.LSTM(16, dropout=0.2)(x)
        x = layers.Dense(16, activation="relu")(x)
        outputs = layers.Dense(1)(x)
        
        model = Model(inputs, outputs)
        model.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        return model
    
    def _prepare_sequences(self, features: np.ndarray, seq_len: int) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare sequences for training"""
        X, y = [], []
        for i in range(len(features) - seq_len):
            X.append(features[i:i+seq_len])
            y.append(features[i+seq_len, 0])  # Target is kmr (first column)
        return np.array(X), np.array(y)
    
    def train_patient_model(self, patient_code: str, kmr_df: pd.DataFrame) -> Optional[dict]:
        """
        Train model for a single patient
        
        Returns dict with predictions and residuals
        """
        if not HAS_TF:
            return self._simple_prediction(kmr_df)
        
        # Feature engineering
        features_df = self._feature_engineering(kmr_df)
        n_points = len(features_df)
        
        if n_points < 5:
            return self._simple_prediction(kmr_df)
        
        # Determine model complexity and sequence length
        complexity = self._determine_complexity(n_points)
        seq_len = self._calculate_seq_len(n_points)
        
        # Feature columns
        feature_cols = ["kmr", "delta_from_baseline", "ratio_from_baseline", "ewma", "rolling_cv", "slope_short"]
        features = features_df[feature_cols].values
        
        # Normalize
        mean = features.mean(axis=0)
        std = features.std(axis=0) + 1e-6
        features_norm = (features - mean) / std
        
        self.scalers[patient_code] = {"mean": mean, "std": std}
        
        # Prepare sequences
        if n_points <= seq_len + 1:
            return self._simple_prediction(kmr_df)
        
        X, y = self._prepare_sequences(features_norm, seq_len)
        
        if len(X) < 2:
            return self._simple_prediction(kmr_df)
        
        # Build model
        n_features = len(feature_cols)
        if complexity == "simple":
            model = self._build_simple_model(seq_len, n_features)
        elif complexity == "medium":
            model = self._build_medium_model(seq_len, n_features)
        else:
            model = self._build_complex_model(seq_len, n_features)
        
        # Callbacks
        callbacks = [
            EarlyStopping(patience=5, restore_best_weights=True, verbose=0),
            ReduceLROnPlateau(factor=0.7, patience=3, min_lr=0.0001, verbose=0)
        ]
        
        # Train
        try:
            model.fit(X, y, epochs=50, batch_size=min(8, len(X)), 
                     validation_split=0.2, callbacks=callbacks, verbose=0, shuffle=False)
        except Exception as e:
            print(f"⚠️ Training failed for {patient_code}: {e}")
            return self._simple_prediction(kmr_df)
        
        self.models[patient_code] = model
        
        # Generate predictions for unified grid (order 1-22, has_kmr=True)
        # Unified grid için forecast üret
        predictions = self._generate_predictions_unified_grid(
            model, features_norm, seq_len, mean[0], std[0], kmr_df
        )
        
        return {
            "predictions": predictions,
            "complexity": complexity,
            "seq_len": seq_len
        }
    
    def _generate_predictions(self, model: Any, features_norm: np.ndarray, 
                             seq_len: int, kmr_mean: float, kmr_std: float) -> List[dict]:
        """Generate predictions for each time point (legacy method)"""
        predictions = []
        n_points = len(features_norm)
        
        for i in range(n_points):
            if i < seq_len:
                # Not enough history, use simple extrapolation
                pred = features_norm[i, 0] * kmr_std + kmr_mean
                pred_lo = pred * 0.8
                pred_hi = pred * 1.2
                pred_status = "warmup_bootstrap"
            else:
                # Use model
                seq = features_norm[i-seq_len:i].reshape(1, seq_len, -1)
                pred_norm = model.predict(seq, verbose=0)[0, 0]
                pred = pred_norm * kmr_std + kmr_mean
                # Confidence interval (simplified)
                pred_lo = pred * 0.85
                pred_hi = pred * 1.15
                pred_status = "ok"
            
            pred, pred_lo, pred_hi = self._sanitize_prediction(pred, pred_lo, pred_hi)
            actual = features_norm[i, 0] * kmr_std + kmr_mean
            residual = actual - pred
            
            predictions.append({
                "kmr_pred": round(float(pred), 4),
                "kmr_pred_lo": round(float(pred_lo), 4),
                "kmr_pred_hi": round(float(pred_hi), 4),
                "kmr_pred_status": pred_status,
                "residual": round(float(residual), 4)
            })
        
        return predictions
    
    def _generate_predictions_unified_grid(self, model: Any, features_norm: np.ndarray,
                                          seq_len: int, kmr_mean: float, kmr_std: float,
                                          kmr_df: pd.DataFrame) -> List[dict]:
        """
        Generate predictions for unified grid (order 1-22, has_kmr=True)
        Forecast horizon: Day_1 to Month_12 (order 1-22)
        """
        # Get unified time keys with KMR data (has_kmr=True), sorted by order
        unified_kmr_time_keys = [
            tk for tk, info in sorted(UNIFIED_TIME_MAP.items(), key=lambda x: x[1]["order"])
            if info.get("has_kmr", False)
        ]
        
        # Create lookup for actual KMR values and features by time_order
        kmr_lookup = {}
        order_to_idx = {}  # Map time_order to features_norm index
        for i, (_, row) in enumerate(kmr_df.iterrows()):
            order = row.get("time_order")
            if order is not None:
                kmr_lookup[order] = row.get("kmr")
                if i < len(features_norm):
                    order_to_idx[order] = i
        
        predictions = []
        forecast_features = None  # For forecast beyond last data point
        
        # Generate predictions for unified grid (order 1-22)
        for time_key in unified_kmr_time_keys:
            info = UNIFIED_TIME_MAP[time_key]
            time_order = info["order"]
            
            # Check if we have actual data for this time point
            actual_kmr = kmr_lookup.get(time_order)
            idx = order_to_idx.get(time_order)
            
            if idx is not None and idx < len(features_norm):
                # We have actual data - use model prediction
                features_vec = features_norm[idx]
                forecast_features = features_vec  # Update for future forecasts
                
                if idx >= seq_len and len(features_norm) > seq_len:
                    # Use model
                    seq = features_norm[idx-seq_len:idx].reshape(1, seq_len, -1)
                    pred_norm = model.predict(seq, verbose=0)[0, 0]
                    pred = pred_norm * kmr_std + kmr_mean
                    pred_status = "ok"
                else:
                    # Not enough history, use actual value or simple extrapolation
                    if actual_kmr is not None:
                        pred = actual_kmr
                        pred_status = "warmup_copy"
                    else:
                        pred = features_vec[0] * kmr_std + kmr_mean
                        pred_status = "warmup_bootstrap"
            else:
                # Forecast: no actual data, use model with last known sequence
                if forecast_features is not None and len(features_norm) >= seq_len:
                    # Use last known sequence for multi-step forecast
                    # Find last known index
                    last_idx = None
                    for o in sorted(order_to_idx.keys(), reverse=True):
                        if o < time_order:
                            last_idx = order_to_idx[o]
                            break
                    
                    if last_idx is not None and last_idx >= seq_len - 1:
                        # Use last seq_len features for forecast
                        seq = features_norm[last_idx-seq_len+1:last_idx+1].reshape(1, seq_len, -1)
                        pred_norm = model.predict(seq, verbose=0)[0, 0]
                        pred = pred_norm * kmr_std + kmr_mean
                    else:
                        # Fallback: use last known KMR value or mean
                        last_kmr = None
                        for o in sorted(kmr_lookup.keys(), reverse=True):
                            if o < time_order:
                                last_kmr = kmr_lookup[o]
                                break
                        pred = last_kmr if last_kmr is not None else kmr_mean
                else:
                    # No history, use mean
                    pred = kmr_mean
                pred_status = "forecast"
            
            # Confidence intervals (wider for forecasts)
            if actual_kmr is None:
                # Forecast: wider confidence interval
                pred_lo = pred * 0.75
                pred_hi = pred * 1.25
            else:
                # Historical prediction: tighter interval
                pred_lo = pred * 0.85
                pred_hi = pred * 1.15
            
            pred, pred_lo, pred_hi = self._sanitize_prediction(pred, pred_lo, pred_hi)

            # Residual (only if actual exists)
            residual = (actual_kmr - pred) if actual_kmr is not None else None
            
            predictions.append({
                "time_order": time_order,
                "time_key": time_key,
                "kmr_pred": round(float(pred), 4),
                "kmr_pred_lo": round(float(pred_lo), 4),
                "kmr_pred_hi": round(float(pred_hi), 4),
                "kmr_pred_status": pred_status,
                "residual": round(float(residual), 4) if residual is not None else None
            })
        
        return predictions
    
    def _simple_prediction(self, kmr_df: pd.DataFrame) -> dict:
        """Simple prediction for unified grid (order 1-22, has_kmr=True)"""
        # Get unified time keys with KMR data (has_kmr=True)
        unified_kmr_time_keys = [
            tk for tk, info in sorted(UNIFIED_TIME_MAP.items(), key=lambda x: x[1]["order"])
            if info.get("has_kmr", False)
        ]
        
        # Create lookup for actual KMR values by time_order
        kmr_lookup = {}
        for _, row in kmr_df.iterrows():
            order = row.get("time_order")
            if order is not None:
                kmr_lookup[order] = row.get("kmr")
        
        # Calculate EWMA from available data
        df = kmr_df.sort_values("time_order").copy()
        if len(df) > 0:
            ewma = df["kmr"].ewm(span=3, min_periods=1).mean()
            ewma_lookup = {row.get("time_order"): ewma.iloc[i] 
                          for i, (_, row) in enumerate(df.iterrows())}
            last_ewma = ewma.iloc[-1] if len(ewma) > 0 else df["kmr"].mean()
        else:
            ewma_lookup = {}
            last_ewma = 0.5  # Default fallback
        
        predictions = []
        for time_key in unified_kmr_time_keys:
            info = UNIFIED_TIME_MAP[time_key]
            time_order = info["order"]
            
            actual_kmr = kmr_lookup.get(time_order)
            
            if time_order in ewma_lookup:
                # Use EWMA for this point
                pred = ewma_lookup[time_order]
                pred_status = "fallback_ewma"
            else:
                # Forecast: use last EWMA value
                pred = last_ewma
                pred_status = "fallback_forecast"
            
            pred_lo = pred * 0.7
            pred_hi = pred * 1.3
            pred, pred_lo, pred_hi = self._sanitize_prediction(pred, pred_lo, pred_hi)
            residual = (actual_kmr - pred) if actual_kmr is not None else None
            
            predictions.append({
                "time_order": time_order,
                "time_key": time_key,
                "kmr_pred": round(float(pred), 4),
                "kmr_pred_lo": round(float(pred_lo), 4),
                "kmr_pred_hi": round(float(pred_hi), 4),
                "kmr_pred_status": pred_status,
                "residual": round(float(residual), 4) if residual is not None else None
            })
        
        return {
            "predictions": predictions,
            "complexity": "simple_fallback",
            "seq_len": 0
        }
    
    def bulk_train(self, kmr_long: pd.DataFrame) -> Dict[str, dict]:
        """Train models for all patients"""
        results = {}
        patients = kmr_long["patient_code"].unique()
        
        print(f"🧠 Training KMR models for {len(patients)} patients...")
        
        for i, patient in enumerate(patients):
            patient_df = kmr_long[kmr_long["patient_code"] == patient].copy()
            result = self.train_patient_model(patient, patient_df)
            results[patient] = result
            
            if (i + 1) % 10 == 0:
                print(f"   Trained {i+1}/{len(patients)} models")
        
        print(f"✅ All KMR models trained")
        return results


if __name__ == "__main__":
    from io_excel import load_all_data
    
    meta, kmr_long, lab_long, improved, raw = load_all_data()
    
    predictor = KMRPredictor()
    results = predictor.bulk_train(kmr_long)
    
    print("\nSample result:")
    sample_patient = list(results.keys())[0]
    print(f"Patient {sample_patient}: {results[sample_patient]}")
