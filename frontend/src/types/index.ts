// Patient Timeline Point
export interface TimelinePoint {
  time_key: string;
  time_order: number;
  pseudo_time_days: number;
  kmr: number;
  kre: number | null;
  gfr: number | null;
  kmr_pred: number | null;
  kmr_pred_lo: number | null;
  kmr_pred_hi: number | null;
  kmr_pred_status?: string;
  kre_pred: number | null;
  kre_pred_lo: number | null;
  kre_pred_hi: number | null;
  kre_pred_status?: string;
  gfr_pred: number | null;
  gfr_pred_lo: number | null;
  gfr_pred_hi: number | null;
  gfr_pred_status?: string;
  kmr_anomaly_score: number;
  kmr_anomaly_flag: boolean;
  kre_anomaly_score: number | null;
  kre_anomaly_flag: boolean;
  gfr_anomaly_score: number | null;
  gfr_anomaly_flag: boolean;
  kre_level_score: number | null;
  gfr_level_score: number | null;
  lab_trend_score: number | null;
  risk_components: RiskComponents;
  risk_score: number;
  risk_level: RiskLevel;
}

export interface RiskComponents {
  kmr_level: number;
  kmr_trend: number;
  kmr_volatility: number;
  kmr_ae: number;
  kmr_residual: number;
  lab_level: number;
  lab_trend: number;
}

export type RiskLevel = 'Normal' | 'Dikkat' | 'Kritik' | 'Çok Kritik';

// Patient Meta
export interface PatientMeta {
  patient_code: string;
  age: number | null;
  BMI: number | null;
  gender: string | null;
  vital_status: string | null;
  blood_group: string | null;
  improved_proxy: boolean;
  n_kmr_points: number;
  n_kre_points: number;
  n_gfr_points: number;
}

// Patient Last Status
export interface LastStatus {
  last_time_key: string | null;
  last_time_order: number | null;
  kmr_last: number | null;
  kre_last: number | null;
  gfr_last: number | null;
  last_kmr_order: number | null;  // Son gerçek KMR noktasının time_order'ı
  last_kre_order: number | null;  // Son gerçek KRE noktasının time_order'ı
  last_gfr_order: number | null;  // Son gerçek GFR noktasının time_order'ı
  risk_last: number;
  risk_level_last: RiskLevel;
}

// Complete Patient Data
export interface PatientData {
  meta: PatientMeta;
  timeline: TimelinePoint[];
  last_status: LastStatus;
}

// Patient Features (for list)
export interface PatientFeature {
  patient_code: string;
  age: number | null;
  gender: string | null;
  vital_status: string | null;
  improved_proxy: boolean;
  n_kmr_points: number;
  n_kre_points: number;
  n_gfr_points: number;
  last_kmr: number | null;
  last_kre: number | null;
  last_gfr: number | null;
  last_kmr_time_key: string | null;
  last_kre_time_key: string | null;
  last_gfr_time_key: string | null;
  last_kmr_time_order: number | null;
  last_kre_time_order: number | null;
  last_gfr_time_order: number | null;
  kmr_slope: number | null;
  kre_slope: number | null;
  gfr_slope: number | null;
  kmr_variability: number | null;
  risk_score: number;
  previous_risk_score?: number | null;
  risk_delta?: number | null;
  last_measurement_time_key?: string | null;
  last_measurement_time_order?: number | null;
  risk_level: RiskLevel;
  has_anomaly: boolean;
  kmr_has_anomaly: boolean;
  kre_has_anomaly: boolean;
  gfr_has_anomaly: boolean;
  kmr_threshold_breach?: boolean;
  kre_threshold_breach?: boolean;
  gfr_threshold_breach?: boolean;
  any_threshold_breach?: boolean;
}

export interface PatientFeaturesData {
  patients: PatientFeature[];
}

// Reference Band
export interface BandPoint {
  time_key: string;
  time_order: number;
  n_samples?: number;
  median: number;
  mean?: number;
  std?: number;
  p25: number;
  p75: number;
  p2_5?: number;
  p97_5?: number;
  min?: number;
  max?: number;
}

export interface ReferenceBandData {
  metadata: {
    created_at: string;
    schema_version: string;
    cohort_definition: string;
    improved_cohort_size: number;
    improved_patients: string[];
  };
  bands: {
    kmr: BandPoint[];
    kre: BandPoint[];
    gfr: BandPoint[];
  };
  clinical_thresholds: {
    kmr: {
      normal_lt: number;
      dikkat_0_5_to_2: boolean;
      kritik_2_to_5: boolean;
      cok_kritik_gt: number;
    };
    kre: {
      very_good_lt: number;
      very_bad_gt: number;
    };
    gfr: {
      very_good_ge: number;
      very_bad_le: number;
    };
  };
}

// Data Summary
export interface DataSummary {
  metadata: {
    created_at: string;
    schema_version: string;
  };
  totals: {
    n_patients: number;
    improved_proxy_count: number;
    patients_with_anomalies: number;
  };
  risk_distribution: {
    Normal: number;
    Dikkat: number;
    Kritik: number;
    'Çok Kritik': number;
  };
  averages: {
    risk_score: number;
    kmr_last: number | null;
    kre_last: number | null;
    gfr_last: number | null;
  };
}

// Channel Overview
export interface ChannelOverview {
  metadata: {
    created_at: string;
  };
  metrics: string[];
  coverage: {
    kmr: {
      time_keys: string[];
      n_measurements: number;
    };
    kre: {
      time_keys: string[];
      n_measurements: number;
    };
    gfr: {
      time_keys: string[];
      n_measurements: number;
    };
  };
}

// Risk Colors
export const RISK_COLORS: Record<RiskLevel, string> = {
  'Normal': '#22c55e',
  'Dikkat': '#f59e0b',
  'Kritik': '#f97316',
  'Çok Kritik': '#ef4444',
};

// Clinical Threshold Lines
export const KMR_THRESHOLDS = {
  normal: 0.5,
  dikkat: 2.0,
  kritik: 5.0,
};

export const KRE_THRESHOLDS = {
  very_good: 1.2,
  very_bad: 4.5,
};

export const GFR_THRESHOLDS = {
  very_good: 90,
  very_bad: 15,
};
