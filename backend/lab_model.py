"""
LAB Model - LSTM prediction for KRE/GFR time series
Supports both single-variable and multi-output models
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
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
from .time_mapping import LAB_TIME_MAP, UNIFIED_TIME_MAP, get_lab_time_info, get_unified_time_info


class LABPredictor:
    """LSTM-based KRE/GFR prediction model"""
    
    def __init__(self, config: dict = None):
        self.config = config or MODEL_CONFIG
        self.models: Dict[str, Any] = {}  # Model type when TF available
        self.scalers: Dict[str, dict] = {}
        self.use_multi_output = True  # Use multi-output model for KRE+GFR

    @staticmethod
    def _sanitize_prediction(metric: str, pred: float, pred_lo: float, pred_hi: float) -> Tuple[float, float, float]:
        """Clamp predictions to physiological bounds and keep lo <= pred <= hi."""
        bounds = {
            "kre": (0.0, 15.0),
            "gfr": (0.0, 180.0),
        }
        lower, upper = bounds.get(metric, (0.0, 1e9))
        pred = float(np.clip(pred, lower, upper))
        pred_lo = float(np.clip(pred_lo, lower, upper))
        pred_hi = float(np.clip(pred_hi, lower, upper))
        lo, hi = sorted((pred_lo, pred_hi))
        pred = float(np.clip(pred, lo, hi))
        return pred, lo, hi

    def _apply_gfr_bias_calibration(self, predictions: List[dict], actual_lookup: Dict[int, Any]) -> List[dict]:
        """
        Apply lightweight patient-level bias correction for GFR predictions.
        Uses observed points only; robust + clipped correction avoids overfitting
        and prevents implausible zero-collapse on low points.
        """
        errors = []
        observed_values = []
        for p in predictions:
            status = p.get("gfr_pred_status")
            if isinstance(status, str) and status.startswith("warmup_"):
                continue
            order = p.get("time_order")
            actual = actual_lookup.get(order)
            pred = p.get("gfr_pred")
            if isinstance(actual, (int, float)) and not np.isnan(actual) and isinstance(pred, (int, float)):
                errors.append(float(pred) - float(actual))
                observed_values.append(float(actual))

        if len(errors) < 4:
            return predictions

        errors_arr = np.array(errors, dtype=float)
        q1, q3 = np.percentile(errors_arr, [25, 75])
        iqr = max(q3 - q1, 1e-6)
        inlier_mask = (errors_arr >= (q1 - 1.5 * iqr)) & (errors_arr <= (q3 + 1.5 * iqr))
        core = errors_arr[inlier_mask] if int(np.sum(inlier_mask)) >= 3 else errors_arr

        # Robust (median) correction with conservative cap.
        raw_correction = float(np.median(core))
        max_abs_correction = max(8.0, float(np.std(core)) * 1.5)
        correction = float(np.clip(raw_correction, -max_abs_correction, max_abs_correction))

        if abs(correction) < 0.1:
            return predictions

        global_floor = 1.0
        if observed_values:
            global_floor = max(1.0, float(np.percentile(np.array(observed_values), 10)) * 0.35)

        calibrated = []
        for p in predictions:
            status = p.get("gfr_pred_status")
            if isinstance(status, str) and status.startswith("warmup_"):
                calibrated.append(p)
                continue
            pred = p.get("gfr_pred")
            lo = p.get("gfr_pred_lo")
            hi = p.get("gfr_pred_hi")
            if not all(isinstance(x, (int, float)) for x in [pred, lo, hi]):
                calibrated.append(p)
                continue

            pred_adj = float(pred) - correction
            lo_adj = float(lo) - correction
            hi_adj = float(hi) - correction

            order = p.get("time_order")
            actual = actual_lookup.get(order)
            if isinstance(actual, (int, float)) and not np.isnan(actual):
                # Keep calibrated prediction within clinically plausible fraction of measured value.
                point_floor = max(1.0, float(actual) * 0.35)
            else:
                point_floor = global_floor

            pred_adj = max(pred_adj, point_floor)
            lo_adj = max(lo_adj, min(point_floor, pred_adj))
            hi_adj = max(hi_adj, pred_adj)
            pred_adj, lo_adj, hi_adj = self._sanitize_prediction("gfr", pred_adj, lo_adj, hi_adj)

            residual = None
            if isinstance(actual, (int, float)) and not np.isnan(actual):
                residual = round(float(actual - pred_adj), 1)

            calibrated.append({
                **p,
                "gfr_pred": round(pred_adj, 1),
                "gfr_pred_lo": round(lo_adj, 1),
                "gfr_pred_hi": round(hi_adj, 1),
                "residual": residual,
            })

        return calibrated
    
    def _winsorize_values(self, values: np.ndarray, metric: str) -> np.ndarray:
        """Winsorize extreme values based on clinical thresholds"""
        winsorized = values.copy()
        
        if metric == "kre":
            # KRE > 10 is extreme
            upper_limit = 10.0
            winsorized[winsorized > upper_limit] = upper_limit
        elif metric == "gfr":
            # GFR < 5 is extreme
            lower_limit = 5.0
            winsorized[winsorized < lower_limit] = lower_limit
        
        return winsorized
    
    def _prepare_unified_grid(self, lab_df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare LAB data on unified time grid (UNIFIED_TIME_MAP order)
        Missing points are set to NaN (no forward fill)
        """
        # LAB data from io_excel.py uses base time_key (e.g., "Day_7", "Month_4")
        # without _KRE/_GFR suffix. Each row has both kre and gfr columns.
        
        # Create lookup by base time_key
        lab_lookup = {}
        for _, row in lab_df.iterrows():
            base_key = row["time_key"]  # Already base key, no suffix
            if base_key not in lab_lookup:
                lab_lookup[base_key] = {}
            lab_lookup[base_key]["kre"] = row.get("kre")
            lab_lookup[base_key]["gfr"] = row.get("gfr")
        
        # Map to unified time grid
        unified_grid = []
        for time_key, info in sorted(UNIFIED_TIME_MAP.items(), key=lambda x: x[1]["order"]):
            if info["has_lab"]:
                # time_key is already base key (e.g., "Day_7")
                base_key = time_key
                
                kre_val = None
                gfr_val = None
                
                if base_key in lab_lookup:
                    kre_val = lab_lookup[base_key].get("kre")
                    gfr_val = lab_lookup[base_key].get("gfr")
                
                unified_grid.append({
                    "time_key": time_key,
                    "time_order": info["order"],
                    "pseudo_time_days": info["pseudo_days"],
                    "kre": kre_val,
                    "gfr": gfr_val
                })
        
        return pd.DataFrame(unified_grid)
    
    def _feature_engineering(self, lab_series: pd.DataFrame, metric: str) -> pd.DataFrame:
        """
        Feature engineering for LAB series (KRE or GFR)
        
        Input: DataFrame with columns [time_order, pseudo_time_days, kre/gfr]
        """
        df = lab_series.sort_values("time_order").copy()
        value_col = metric.lower()  # "kre" or "gfr"
        
        if value_col not in df.columns:
            return df
        
        values = df[value_col].values
        
        # Winsorize extreme values
        values = self._winsorize_values(values, value_col)
        df[value_col] = values
        
        # Baseline (first measurement)
        baseline = df[value_col].iloc[0] if not pd.isna(df[value_col].iloc[0]) else df[value_col].dropna().iloc[0] if df[value_col].notna().any() else 0
        
        # Delta and ratio from baseline
        df["delta_from_baseline"] = df[value_col] - baseline
        if value_col == "kre":
            # KRE: lower is better, ratio < 1 is good
            df["ratio_from_baseline"] = df[value_col] / (baseline + 1e-6)
        else:  # GFR
            # GFR: higher is better, ratio > 1 is good
            df["ratio_from_baseline"] = df[value_col] / (baseline + 1e-6)
        
        # EWMA
        df["ewma"] = df[value_col].ewm(span=3, min_periods=1).mean()
        
        # Rolling CV
        rolling_std = df[value_col].rolling(window=3, min_periods=1).std()
        rolling_mean = df[value_col].rolling(window=3, min_periods=1).mean()
        df["rolling_cv"] = rolling_std / (rolling_mean + 1e-6)
        
        # Short-term slope (last 2-3 points)
        df["slope_short"] = 0.0
        if len(df) >= 2:
            for i in range(1, len(df)):
                y = df[value_col].iloc[max(0, i-2):i+1].values
                x = np.arange(len(y))
                if len(y) >= 2 and not np.any(np.isnan(y)):
                    slope = np.polyfit(x, y, 1)[0]
                    df.iloc[i, df.columns.get_loc("slope_short")] = slope
        
        # Fill NaN
        df = df.fillna(0)
        
        return df
    
    def _build_single_model(self, seq_len: int, n_features: int, metric: str) -> Any:
        """Build single-variable LSTM model for KRE or GFR"""
        inputs = layers.Input(shape=(seq_len, n_features))
        x = layers.LSTM(32, return_sequences=True, dropout=0.15)(inputs)
        x = layers.LSTM(16, dropout=0.15)(x)
        x = layers.Dense(8, activation="relu")(x)
        outputs = layers.Dense(1)(x)
        
        model = Model(inputs, outputs, name=f"lab_{metric}_lstm")
        model.compile(optimizer=keras.optimizers.Adam(0.001), loss="mse")
        return model
    
    def _build_multi_output_model(self, seq_len: int, n_features: int) -> Any:
        """Build multi-output LSTM model for KRE+GFR together"""
        inputs = layers.Input(shape=(seq_len, n_features))
        
        # Shared encoder
        x = layers.LSTM(32, return_sequences=True, dropout=0.15)(inputs)
        x = layers.LSTM(16, dropout=0.15)(x)
        
        # Separate heads for KRE and GFR
        kre_head = layers.Dense(8, activation="relu")(x)
        kre_output = layers.Dense(1, name="kre_output")(kre_head)
        
        gfr_head = layers.Dense(8, activation="relu")(x)
        gfr_output = layers.Dense(1, name="gfr_output")(gfr_head)
        
        model = Model(inputs, [kre_output, gfr_output], name="lab_multi_lstm")
        model.compile(
            optimizer=keras.optimizers.Adam(0.001),
            loss={"kre_output": "mse", "gfr_output": "mse"},
            loss_weights={"kre_output": 0.5, "gfr_output": 0.5}
        )
        return model
    
    def _prepare_sequences(self, features: np.ndarray, targets: np.ndarray, seq_len: int) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare sequences for training"""
        X, y = [], []
        for i in range(len(features) - seq_len):
            X.append(features[i:i+seq_len])
            y.append(targets[i+seq_len])
        return np.array(X), np.array(y)
    
    def _prepare_multi_sequences(self, features: np.ndarray, kre_targets: np.ndarray, 
                                 gfr_targets: np.ndarray, seq_len: int) -> Tuple[np.ndarray, List[np.ndarray]]:
        """Prepare sequences for multi-output training"""
        X, y_kre, y_gfr = [], [], []
        for i in range(len(features) - seq_len):
            X.append(features[i:i+seq_len])
            y_kre.append(kre_targets[i+seq_len])
            y_gfr.append(gfr_targets[i+seq_len])
        return np.array(X), [np.array(y_kre), np.array(y_gfr)]
    
    def train_patient_model(self, patient_code: str, lab_df: pd.DataFrame) -> Optional[dict]:
        """
        Train model for a single patient
        
        Returns dict with predictions for KRE and GFR
        """
        if not HAS_TF:
            return self._simple_prediction(lab_df)
        
        # Prepare unified grid
        unified_df = self._prepare_unified_grid(lab_df)
        
        # Check minimum data points (≥3 measurements)
        kre_valid = unified_df["kre"].notna().sum()
        gfr_valid = unified_df["gfr"].notna().sum()
        
        if kre_valid < 3 and gfr_valid < 3:
            return self._simple_prediction(lab_df)
        
        # Use multi-output if both metrics have enough data
        use_multi = self.use_multi_output and kre_valid >= 3 and gfr_valid >= 3
        
        if use_multi:
            return self._train_multi_output(patient_code, unified_df)
        else:
            # Train separate models
            results = {}
            if kre_valid >= 3:
                results["kre"] = self._train_single_metric(patient_code, unified_df, "kre")
            if gfr_valid >= 3:
                results["gfr"] = self._train_single_metric(patient_code, unified_df, "gfr")
            return results if results else self._simple_prediction(lab_df)
    
    def _train_single_metric(self, patient_code: str, unified_df: pd.DataFrame, metric: str) -> dict:
        """Train single-variable model for KRE or GFR"""
        # Feature engineering
        features_df = self._feature_engineering(unified_df, metric)
        n_points = len(features_df)
        
        # Determine sequence length
        seq_len = max(self.config["seq_len_min"], min(round(n_points / 3), self.config["seq_len_max"]))
        
        # Feature columns
        feature_cols = [metric.lower(), "delta_from_baseline", "ratio_from_baseline", "ewma", "rolling_cv", "slope_short"]
        features = features_df[feature_cols].values
        targets = features_df[metric.lower()].values
        
        # Remove NaN rows
        valid_mask = ~np.isnan(targets)
        features = features[valid_mask]
        targets = targets[valid_mask]
        
        if len(features) < seq_len + 1:
            return self._simple_prediction_single(unified_df, metric)
        
        # Normalize
        mean = features.mean(axis=0)
        std = features.std(axis=0) + 1e-6
        features_norm = (features - mean) / std
        
        self.scalers[f"{patient_code}_{metric}"] = {"mean": mean, "std": std}
        
        # Prepare sequences
        X, y = self._prepare_sequences(features_norm, targets, seq_len)
        
        if len(X) < 2:
            return self._simple_prediction_single(unified_df, metric)
        
        # Build model
        n_features = len(feature_cols)
        model = self._build_single_model(seq_len, n_features, metric)
        
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
            print(f"⚠️ Training failed for {patient_code} {metric}: {e}")
            return self._simple_prediction_single(unified_df, metric)
        
        self.models[f"{patient_code}_{metric}"] = model
        
        # Generate predictions for unified grid (all has_lab=True time_keys)
        predictions = self._generate_predictions_single_unified(
            model, features_norm, targets, unified_df, seq_len, mean[0], std[0], metric
        )
        
        return {
            "predictions": predictions,
            "complexity": "medium",
            "seq_len": seq_len
        }
    
    def _train_multi_output(self, patient_code: str, unified_df: pd.DataFrame) -> dict:
        """Train multi-output model for KRE+GFR"""
        # Feature engineering for both metrics
        kre_features_df = self._feature_engineering(unified_df, "kre")
        gfr_features_df = self._feature_engineering(unified_df, "gfr")
        
        # Combine features (use KRE features as base, add GFR-specific)
        feature_cols = ["kre", "delta_from_baseline", "ratio_from_baseline", "ewma", "rolling_cv", "slope_short"]
        kre_features = kre_features_df[feature_cols].values
        gfr_features = gfr_features_df[["gfr", "delta_from_baseline", "ratio_from_baseline", "ewma", "rolling_cv", "slope_short"]].values
        
        # Combine into multi-feature array (KRE + GFR features)
        combined_features = np.hstack([kre_features, gfr_features])
        
        kre_targets = unified_df["kre"].values
        gfr_targets = unified_df["gfr"].values
        
        # Remove NaN rows (both must be valid for multi-output)
        valid_mask = ~(np.isnan(kre_targets) | np.isnan(gfr_targets))
        combined_features = combined_features[valid_mask]
        kre_targets = kre_targets[valid_mask]
        gfr_targets = gfr_targets[valid_mask]
        
        n_points = len(combined_features)
        seq_len = max(self.config["seq_len_min"], min(round(n_points / 3), self.config["seq_len_max"]))
        
        if n_points < seq_len + 1:
            return self._simple_prediction_multi(unified_df)
        
        # Normalize
        mean = combined_features.mean(axis=0)
        std = combined_features.std(axis=0) + 1e-6
        features_norm = (combined_features - mean) / std
        
        self.scalers[f"{patient_code}_multi"] = {"mean": mean, "std": std}
        
        # Prepare sequences
        X, y_list = self._prepare_multi_sequences(features_norm, kre_targets, gfr_targets, seq_len)
        
        if len(X) < 2:
            return self._simple_prediction_multi(unified_df)
        
        # Build model
        n_features = combined_features.shape[1]
        model = self._build_multi_output_model(seq_len, n_features)
        
        # Callbacks
        callbacks = [
            EarlyStopping(patience=5, restore_best_weights=True, verbose=0),
            ReduceLROnPlateau(factor=0.7, patience=3, min_lr=0.0001, verbose=0)
        ]
        
        # Train
        try:
            model.fit(X, y_list, epochs=50, batch_size=min(8, len(X)), 
                     validation_split=0.2, callbacks=callbacks, verbose=0, shuffle=False)
        except Exception as e:
            print(f"⚠️ Multi-output training failed for {patient_code}: {e}")
            return self._simple_prediction_multi(unified_df)
        
        self.models[f"{patient_code}_multi"] = model
        
        # Generate predictions for unified grid
        kre_pred, gfr_pred = self._generate_predictions_multi_unified(
            model, features_norm, kre_targets, gfr_targets, unified_df, seq_len, mean, std
        )
        
        return {
            "kre_predictions": kre_pred,
            "gfr_predictions": gfr_pred,
            "complexity": "multi_output",
            "seq_len": seq_len
        }
    
    def _generate_predictions_single(self, model: Any, features_norm: np.ndarray,
                                    targets: np.ndarray, seq_len: int,
                                    value_mean: float, value_std: float, metric: str) -> List[dict]:
        """Generate predictions for single metric"""
        predictions = []
        n_points = len(features_norm)
        
        for i in range(n_points):
            if i < seq_len:
                # Not enough history
                pred = targets[i] if not np.isnan(targets[i]) else value_mean
                pred_lo = pred * 0.8 if metric == "kre" else pred * 0.9
                pred_hi = pred * 1.2 if metric == "kre" else pred * 1.1
                pred_status = "warmup_copy" if not np.isnan(targets[i]) else "warmup_bootstrap"
            else:
                # Use model
                seq = features_norm[i-seq_len:i].reshape(1, seq_len, -1)
                pred_norm = model.predict(seq, verbose=0)[0, 0]
                pred = pred_norm * value_std + value_mean
                pred_lo = pred * 0.85 if metric == "kre" else pred * 0.9
                pred_hi = pred * 1.15 if metric == "kre" else pred * 1.1
                pred_status = "ok"

            pred, pred_lo, pred_hi = self._sanitize_prediction(metric, pred, pred_lo, pred_hi)
            
            actual = targets[i] if not np.isnan(targets[i]) else None
            residual = (actual - pred) if actual is not None else None
            
            predictions.append({
                f"{metric}_pred": round(float(pred), 2) if metric == "kre" else round(float(pred), 1),
                f"{metric}_pred_lo": round(float(pred_lo), 2) if metric == "kre" else round(float(pred_lo), 1),
                f"{metric}_pred_hi": round(float(pred_hi), 2) if metric == "kre" else round(float(pred_hi), 1),
                f"{metric}_pred_status": pred_status,
                "residual": round(float(residual), 2) if residual is not None else None
            })
        
        return predictions
    
    def _generate_predictions_multi(self, model: Any, features_norm: np.ndarray,
                                   kre_targets: np.ndarray, gfr_targets: np.ndarray,
                                   seq_len: int, mean: np.ndarray, std: np.ndarray) -> Tuple[List[dict], List[dict]]:
        """Generate predictions for multi-output model"""
        kre_pred_list = []
        gfr_pred_list = []
        n_points = len(features_norm)
        
        # KRE and GFR means/stds are in first and second half of mean/std arrays
        kre_mean = mean[0]
        kre_std = std[0]
        gfr_mean = mean[len(mean)//2]
        gfr_std = std[len(std)//2]
        
        for i in range(n_points):
            if i < seq_len:
                kre_pred = kre_targets[i] if not np.isnan(kre_targets[i]) else kre_mean
                gfr_pred = gfr_targets[i] if not np.isnan(gfr_targets[i]) else gfr_mean
                kre_status = "warmup_copy" if not np.isnan(kre_targets[i]) else "warmup_bootstrap"
                gfr_status = "warmup_copy" if not np.isnan(gfr_targets[i]) else "warmup_bootstrap"
            else:
                seq = features_norm[i-seq_len:i].reshape(1, seq_len, -1)
                preds = model.predict(seq, verbose=0)
                kre_pred_norm = preds[0][0, 0]
                gfr_pred_norm = preds[1][0, 0]
                kre_pred = kre_pred_norm * kre_std + kre_mean
                gfr_pred = gfr_pred_norm * gfr_std + gfr_mean
                kre_status = "ok"
                gfr_status = "ok"
            
            kre_actual = kre_targets[i] if not np.isnan(kre_targets[i]) else None
            gfr_actual = gfr_targets[i] if not np.isnan(gfr_targets[i]) else None

            kre_pred, kre_lo, kre_hi = self._sanitize_prediction("kre", kre_pred, kre_pred * 0.85, kre_pred * 1.15)
            gfr_pred, gfr_lo, gfr_hi = self._sanitize_prediction("gfr", gfr_pred, gfr_pred * 0.9, gfr_pred * 1.1)
            
            kre_residual = (kre_actual - kre_pred) if kre_actual is not None else None
            gfr_residual = (gfr_actual - gfr_pred) if gfr_actual is not None else None
            
            kre_pred_list.append({
                "kre_pred": round(float(kre_pred), 2),
                "kre_pred_lo": round(float(kre_lo), 2),
                "kre_pred_hi": round(float(kre_hi), 2),
                "kre_pred_status": kre_status,
                "residual": round(float(kre_residual), 2) if kre_residual is not None else None
            })
            
            gfr_pred_list.append({
                "gfr_pred": round(float(gfr_pred), 1),
                "gfr_pred_lo": round(float(gfr_lo), 1),
                "gfr_pred_hi": round(float(gfr_hi), 1),
                "gfr_pred_status": gfr_status,
                "residual": round(float(gfr_residual), 1) if gfr_residual is not None else None
            })
        
        return kre_pred_list, gfr_pred_list
    
    def _generate_predictions_single_unified(self, model: Any, features_norm: np.ndarray,
                                             targets: np.ndarray, unified_df: pd.DataFrame,
                                             seq_len: int, value_mean: float, value_std: float,
                                             metric: str) -> List[dict]:
        """
        Generate predictions for unified grid (all has_lab=True time_keys, order 7-22)
        Forecast horizon: Day_7 to Month_12 (order 7-22)
        """
        # Create lookup for actual values and features by time_order
        value_lookup = {}
        order_to_idx = {}  # Map time_order to features_norm index
        for i, (_, row) in enumerate(unified_df.iterrows()):
            order = row.get("time_order")
            if order is not None:
                value_lookup[order] = row.get(metric.lower())
                if i < len(features_norm):
                    order_to_idx[order] = i
        
        predictions = []
        forecast_features = None
        
        # Generate predictions for unified grid (all has_lab=True time_keys)
        for _, row in unified_df.iterrows():
            time_order = row.get("time_order")
            time_key = row.get("time_key")
            actual_val = value_lookup.get(time_order)
            idx = order_to_idx.get(time_order)
            
            if idx is not None and idx < len(features_norm):
                # We have actual data - use model prediction
                forecast_features = features_norm[idx]
                
                if idx >= seq_len and len(features_norm) > seq_len:
                    # Use model
                    seq = features_norm[idx-seq_len:idx].reshape(1, seq_len, -1)
                    pred_norm = model.predict(seq, verbose=0)[0, 0]
                    pred = pred_norm * value_std + value_mean
                    pred_status = "ok"
                else:
                    # Not enough history, use actual value or simple extrapolation
                    if actual_val is not None and not np.isnan(actual_val):
                        pred = actual_val
                        pred_status = "warmup_copy"
                    else:
                        pred = value_mean
                        pred_status = "warmup_bootstrap"
            else:
                # Forecast: no actual data, use model with last known sequence
                if forecast_features is not None and len(features_norm) >= seq_len:
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
                        pred = pred_norm * value_std + value_mean
                    else:
                        # Fallback: use last known value or mean
                        last_val = None
                        for o in sorted(value_lookup.keys(), reverse=True):
                            if o < time_order and value_lookup[o] is not None and not np.isnan(value_lookup[o]):
                                last_val = value_lookup[o]
                                break
                        pred = last_val if last_val is not None else value_mean
                else:
                    # No history, use mean
                    pred = value_mean
                pred_status = "forecast"
            
            # Confidence intervals (wider for forecasts)
            if actual_val is None or np.isnan(actual_val):
                # Forecast: wider confidence interval
                pred_lo = pred * 0.75 if metric == "kre" else pred * 0.85
                pred_hi = pred * 1.25 if metric == "kre" else pred * 1.15
            else:
                # Historical prediction: tighter interval
                pred_lo = pred * 0.85 if metric == "kre" else pred * 0.9
                pred_hi = pred * 1.15 if metric == "kre" else pred * 1.1

            pred, pred_lo, pred_hi = self._sanitize_prediction(metric, pred, pred_lo, pred_hi)
            
            # Residual (only if actual exists)
            residual = (actual_val - pred) if actual_val is not None and not np.isnan(actual_val) else None
            
            predictions.append({
                "time_order": time_order,
                "time_key": time_key,
                f"{metric}_pred": round(float(pred), 2) if metric == "kre" else round(float(pred), 1),
                f"{metric}_pred_lo": round(float(pred_lo), 2) if metric == "kre" else round(float(pred_lo), 1),
                f"{metric}_pred_hi": round(float(pred_hi), 2) if metric == "kre" else round(float(pred_hi), 1),
                f"{metric}_pred_status": pred_status,
                "residual": round(float(residual), 2) if residual is not None and metric == "kre" else (round(float(residual), 1) if residual is not None else None)
            })

        if metric == "gfr":
            predictions = self._apply_gfr_bias_calibration(predictions, value_lookup)

        return predictions
    
    def _generate_predictions_multi_unified(self, model: Any, features_norm: np.ndarray,
                                           kre_targets: np.ndarray, gfr_targets: np.ndarray,
                                           unified_df: pd.DataFrame, seq_len: int,
                                           mean: np.ndarray, std: np.ndarray) -> Tuple[List[dict], List[dict]]:
        """
        Generate predictions for unified grid (all has_lab=True time_keys, order 7-22)
        Forecast horizon: Day_7 to Month_12 (order 7-22)
        """
        # Create lookup for actual values and features by time_order
        kre_lookup = {}
        gfr_lookup = {}
        order_to_idx = {}
        for i, (_, row) in enumerate(unified_df.iterrows()):
            order = row.get("time_order")
            if order is not None:
                kre_lookup[order] = row.get("kre")
                gfr_lookup[order] = row.get("gfr")
                if i < len(features_norm):
                    order_to_idx[order] = i
        
        kre_pred_list = []
        gfr_pred_list = []
        forecast_features = None
        
        # KRE and GFR means/stds
        kre_mean = mean[0]
        kre_std = std[0]
        gfr_mean = mean[len(mean)//2]
        gfr_std = std[len(std)//2]
        
        # Generate predictions for unified grid
        for _, row in unified_df.iterrows():
            time_order = row.get("time_order")
            time_key = row.get("time_key")
            kre_actual = kre_lookup.get(time_order)
            gfr_actual = gfr_lookup.get(time_order)
            idx = order_to_idx.get(time_order)
            
            if idx is not None and idx < len(features_norm):
                # We have actual data - use model prediction
                forecast_features = features_norm[idx]
                
                if idx >= seq_len and len(features_norm) > seq_len:
                    # Use model
                    seq = features_norm[idx-seq_len:idx].reshape(1, seq_len, -1)
                    preds = model.predict(seq, verbose=0)
                    kre_pred_norm = preds[0][0, 0]
                    gfr_pred_norm = preds[1][0, 0]
                    kre_pred = kre_pred_norm * kre_std + kre_mean
                    gfr_pred = gfr_pred_norm * gfr_std + gfr_mean
                    kre_status = "ok"
                    gfr_status = "ok"
                else:
                    # Not enough history, use actual values or mean
                    kre_pred = kre_actual if kre_actual is not None and not np.isnan(kre_actual) else kre_mean
                    gfr_pred = gfr_actual if gfr_actual is not None and not np.isnan(gfr_actual) else gfr_mean
                    kre_status = "warmup_copy" if kre_actual is not None and not np.isnan(kre_actual) else "warmup_bootstrap"
                    gfr_status = "warmup_copy" if gfr_actual is not None and not np.isnan(gfr_actual) else "warmup_bootstrap"
            else:
                # Forecast: no actual data, use model with last known sequence
                if forecast_features is not None and len(features_norm) >= seq_len:
                    # Find last known index
                    last_idx = None
                    for o in sorted(order_to_idx.keys(), reverse=True):
                        if o < time_order:
                            last_idx = order_to_idx[o]
                            break
                    
                    if last_idx is not None and last_idx >= seq_len - 1:
                        # Use last seq_len features for forecast
                        seq = features_norm[last_idx-seq_len+1:last_idx+1].reshape(1, seq_len, -1)
                        preds = model.predict(seq, verbose=0)
                        kre_pred_norm = preds[0][0, 0]
                        gfr_pred_norm = preds[1][0, 0]
                        kre_pred = kre_pred_norm * kre_std + kre_mean
                        gfr_pred = gfr_pred_norm * gfr_std + gfr_mean
                    else:
                        # Fallback: use last known values or mean
                        last_kre = None
                        last_gfr = None
                        for o in sorted(kre_lookup.keys(), reverse=True):
                            if o < time_order:
                                if last_kre is None and kre_lookup[o] is not None and not np.isnan(kre_lookup[o]):
                                    last_kre = kre_lookup[o]
                                if last_gfr is None and gfr_lookup[o] is not None and not np.isnan(gfr_lookup[o]):
                                    last_gfr = gfr_lookup[o]
                                if last_kre is not None and last_gfr is not None:
                                    break
                        kre_pred = last_kre if last_kre is not None else kre_mean
                        gfr_pred = last_gfr if last_gfr is not None else gfr_mean
                else:
                    # No history, use mean
                    kre_pred = kre_mean
                    gfr_pred = gfr_mean
                kre_status = "forecast"
                gfr_status = "forecast"
            
            # Confidence intervals (wider for forecasts)
            if kre_actual is None or np.isnan(kre_actual):
                kre_pred_lo = kre_pred * 0.75
                kre_pred_hi = kre_pred * 1.25
            else:
                kre_pred_lo = kre_pred * 0.85
                kre_pred_hi = kre_pred * 1.15
            
            if gfr_actual is None or np.isnan(gfr_actual):
                gfr_pred_lo = gfr_pred * 0.85
                gfr_pred_hi = gfr_pred * 1.15
            else:
                gfr_pred_lo = gfr_pred * 0.9
                gfr_pred_hi = gfr_pred * 1.1

            kre_pred, kre_pred_lo, kre_pred_hi = self._sanitize_prediction("kre", kre_pred, kre_pred_lo, kre_pred_hi)
            gfr_pred, gfr_pred_lo, gfr_pred_hi = self._sanitize_prediction("gfr", gfr_pred, gfr_pred_lo, gfr_pred_hi)
            
            # Residuals
            kre_residual = (kre_actual - kre_pred) if kre_actual is not None and not np.isnan(kre_actual) else None
            gfr_residual = (gfr_actual - gfr_pred) if gfr_actual is not None and not np.isnan(gfr_actual) else None
            
            kre_pred_list.append({
                "time_order": time_order,
                "time_key": time_key,
                "kre_pred": round(float(kre_pred), 2),
                "kre_pred_lo": round(float(kre_pred_lo), 2),
                "kre_pred_hi": round(float(kre_pred_hi), 2),
                "kre_pred_status": kre_status,
                "residual": round(float(kre_residual), 2) if kre_residual is not None else None
            })
            
            gfr_pred_list.append({
                "time_order": time_order,
                "time_key": time_key,
                "gfr_pred": round(float(gfr_pred), 1),
                "gfr_pred_lo": round(float(gfr_pred_lo), 1),
                "gfr_pred_hi": round(float(gfr_pred_hi), 1),
                "gfr_pred_status": gfr_status,
                "residual": round(float(gfr_residual), 1) if gfr_residual is not None else None
            })

        gfr_pred_list = self._apply_gfr_bias_calibration(gfr_pred_list, gfr_lookup)

        return kre_pred_list, gfr_pred_list
    
    def _simple_prediction_single(self, unified_df: pd.DataFrame, metric: str) -> dict:
        """Simple prediction for unified grid (all has_lab=True time_keys)"""
        df = unified_df.sort_values("time_order").copy()
        values = df[metric.lower()].dropna()
        
        if len(values) == 0:
            # No data, return empty predictions for all unified grid points
            predictions = []
            for _, row in df.iterrows():
                predictions.append({
                    "time_order": row.get("time_order"),
                    "time_key": row.get("time_key"),
                    f"{metric}_pred": None,
                    f"{metric}_pred_lo": None,
                    f"{metric}_pred_hi": None,
                    "residual": None
                })
            return {"predictions": predictions}
        
        # Calculate EWMA from available data
        ewma = values.ewm(span=3, min_periods=1).mean()
        ewma_lookup = {}
        for i, (_, row) in enumerate(df.iterrows()):
            val = row[metric.lower()]
            if not pd.isna(val):
                idx_in_values = df[metric.lower()].notna().iloc[:i+1].sum() - 1
                if idx_in_values >= 0 and idx_in_values < len(ewma):
                    ewma_lookup[row.get("time_order")] = ewma.iloc[idx_in_values]
        
        last_ewma = ewma.iloc[-1] if len(ewma) > 0 else values.mean()
        
        predictions = []
        for _, row in df.iterrows():
            time_order = row.get("time_order")
            time_key = row.get("time_key")
            val = row[metric.lower()]
            
            if time_order in ewma_lookup:
                # Use EWMA for this point
                pred = ewma_lookup[time_order]
                pred_status = "fallback_ewma"
            else:
                # Forecast: use last EWMA value
                pred = last_ewma
                pred_status = "fallback_forecast"
            
            pred_lo = pred * 0.7 if metric == "kre" else pred * 0.8
            pred_hi = pred * 1.3 if metric == "kre" else pred * 1.2
            pred, pred_lo, pred_hi = self._sanitize_prediction(metric, pred, pred_lo, pred_hi)
            residual = (val - pred) if val is not None and not pd.isna(val) else None
            
            predictions.append({
                "time_order": time_order,
                "time_key": time_key,
                f"{metric}_pred": round(float(pred), 2) if metric == "kre" else round(float(pred), 1),
                f"{metric}_pred_lo": round(float(pred_lo), 2) if metric == "kre" else round(float(pred_lo), 1),
                f"{metric}_pred_hi": round(float(pred_hi), 2) if metric == "kre" else round(float(pred_hi), 1),
                f"{metric}_pred_status": pred_status,
                "residual": round(float(residual), 2) if residual is not None and metric == "kre" else (round(float(residual), 1) if residual is not None else None)
            })

        if metric == "gfr":
            value_lookup = {
                int(row.get("time_order")): row.get(metric.lower())
                for _, row in df.iterrows()
                if row.get("time_order") is not None
            }
            predictions = self._apply_gfr_bias_calibration(predictions, value_lookup)

        return {"predictions": predictions}
    
    def _simple_prediction_multi(self, unified_df: pd.DataFrame) -> dict:
        """Fallback simple prediction for multi-output"""
        kre_pred = self._simple_prediction_single(unified_df, "kre")
        gfr_pred = self._simple_prediction_single(unified_df, "gfr")
        return {
            "kre_predictions": kre_pred["predictions"],
            "gfr_predictions": gfr_pred["predictions"]
        }
    
    def _simple_prediction(self, lab_df: pd.DataFrame) -> dict:
        """Fallback simple prediction"""
        unified_df = self._prepare_unified_grid(lab_df)
        kre_valid = unified_df["kre"].notna().sum()
        gfr_valid = unified_df["gfr"].notna().sum()
        
        if kre_valid >= 3 and gfr_valid >= 3:
            return self._simple_prediction_multi(unified_df)
        elif kre_valid >= 3:
            return {"kre": self._simple_prediction_single(unified_df, "kre")}
        elif gfr_valid >= 3:
            return {"gfr": self._simple_prediction_single(unified_df, "gfr")}
        else:
            return {}
    
    def bulk_train(self, lab_long: pd.DataFrame) -> Dict[str, dict]:
        """Train models for all patients"""
        results = {}
        patients = lab_long["patient_code"].unique()
        
        print(f"🧠 Training LAB models for {len(patients)} patients...")
        
        for i, patient in enumerate(patients):
            patient_df = lab_long[lab_long["patient_code"] == patient].copy()
            result = self.train_patient_model(patient, patient_df)
            results[patient] = result
            
            if (i + 1) % 10 == 0:
                print(f"   Trained {i+1}/{len(patients)} models")
        
        print(f"✅ All LAB models trained")
        return results


if __name__ == "__main__":
    from io_excel import load_all_data
    
    meta, kmr_long, lab_long, improved, raw = load_all_data()
    
    predictor = LABPredictor()
    results = predictor.bulk_train(lab_long)
    
    print("\nSample result:")
    sample_patient = list(results.keys())[0]
    print(f"Patient {sample_patient}: {results[sample_patient]}")
