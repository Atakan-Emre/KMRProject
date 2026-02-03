import { useQuery } from '@tanstack/react-query';
import type { 
  PatientData, 
  PatientFeaturesData, 
  DataSummary, 
  ReferenceBandData,
  ChannelOverview,
  RiskLevel
} from '@/types';

// Next.js basePath'i al - GitHub Pages için gerekli
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Fetch helpers
async function fetchJson<T>(url: string): Promise<T> {
  const fullUrl = `${basePath}${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${fullUrl}`);
  }
  return response.json();
}

// Referans bandı hook'u
export function useReferenceBand() {
  return useQuery({
    queryKey: ['reference-band'],
    queryFn: () => fetchJson<ReferenceBandData>('/reference_band.json'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// Hasta listesi hook'u
export function usePatientsList() {
  return useQuery({
    queryKey: ['patients-list'],
    queryFn: () => fetchJson<PatientFeaturesData>('/patient_features.json'),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Özet veriler hook'u
export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: () => fetchJson<DataSummary>('/data_summary.json'),
    staleTime: 5 * 60 * 1000,
  });
}

// Hasta detay hook'u
export function usePatientDetail(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-detail', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      return fetchJson<PatientData>(`/patients/${patientId}.json`);
    },
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });
}

// Kanal genel bakış hook'u
export function useChannelOverview() {
  return useQuery({
    queryKey: ['channel-overview'],
    queryFn: () => fetchJson<ChannelOverview>('/channel_overview.json'),
    staleTime: 5 * 60 * 1000,
  });
}

// Kohort trajectory hook'u (iyileşmiş hastalar LSTM/VAE analizi)
export interface CohortTrajectoryPoint {
  time_key: string;
  time_order: number;
  pseudo_days: number;
  expected_kmr: number;
  cohort_mean: number;
  cohort_median: number;
  cohort_std: number;
  bound_lower: number;
  bound_upper: number;
  iqr_lower: number;
  iqr_upper: number;
  ae_error: number;
}

export interface CohortTrajectoryData {
  metadata: {
    type: string;
    n_patients: number;
    n_time_points: number;
    model: string;
    created_at: string;
  };
  trajectory: CohortTrajectoryPoint[];
  summary: {
    initial_kmr_median: number;
    final_kmr_median: number;
    reduction_percent: number;
    time_to_stable: string | null;
  };
}

export function useCohortTrajectory() {
  return useQuery({
    queryKey: ['cohort-trajectory'],
    queryFn: () => fetchJson<CohortTrajectoryData>('/cohort_trajectory.json'),
    staleTime: 5 * 60 * 1000,
  });
}

// LAB Cohort trajectory hook'u (KRE/GFR için)
export interface LABCohortTrajectoryPoint {
  time_key: string;
  time_order: number;
  pseudo_days: number;
  expected_kre: number | null;
  expected_gfr: number | null;
  cohort_kre_mean: number;
  cohort_kre_median: number;
  cohort_gfr_mean: number;
  cohort_gfr_median: number;
  bound_kre_lower: number;
  bound_kre_upper: number;
  bound_gfr_lower: number;
  bound_gfr_upper: number;
  iqr_kre_lower: number;
  iqr_kre_upper: number;
  iqr_gfr_lower: number;
  iqr_gfr_upper: number;
  ae_kre_error: number | null;
  ae_gfr_error: number | null;
}

export interface LABCohortTrajectoryData {
  metadata: {
    type: string;
    n_patients: number;
    n_time_points: number;
    model: string;
    created_at: string;
  };
  trajectory: LABCohortTrajectoryPoint[];
  summary: {
    initial_kre_median: number | null;
    final_kre_median: number | null;
    initial_gfr_median: number | null;
    final_gfr_median: number | null;
  };
}

export function useLABCohortTrajectory() {
  return useQuery({
    queryKey: ['lab-cohort-trajectory'],
    queryFn: async () => {
      try {
        const response = await fetch(`${basePath}/cohort_trajectory_lab.json`);
        if (!response.ok) {
          // Return empty trajectory if file doesn't exist (404) or other errors
          return {
            metadata: {
              type: "lab_cohort",
              n_patients: 0,
              n_time_points: 0,
              model: "none",
              created_at: new Date().toISOString()
            },
            trajectory: [],
            summary: {
              initial_kre_median: null,
              final_kre_median: null,
              initial_gfr_median: null,
              final_gfr_median: null
            }
          } as LABCohortTrajectoryData;
        }
        return response.json() as Promise<LABCohortTrajectoryData>;
      } catch {
        // Return empty trajectory if file doesn't exist or has insufficient data
        return {
          metadata: {
            type: "lab_cohort",
            n_patients: 0,
            n_time_points: 0,
            model: "none",
            created_at: new Date().toISOString()
          },
          trajectory: [],
          summary: {
            initial_kre_median: null,
            final_kre_median: null,
            initial_gfr_median: null,
            final_gfr_median: null
          }
        } as LABCohortTrajectoryData;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false, // Don't retry on 404
  });
}

// Dashboard için birleşik veriler
export function useDashboardData() {
  const patientsQuery = usePatientsList();
  const summaryQuery = useSummary();
  const referenceBandQuery = useReferenceBand();

  const patients = patientsQuery.data?.patients || [];

  // Dashboard KPI'ları
  const kpis = {
    totalPatients: summaryQuery.data?.totals.n_patients || 0,
    improvedCount: summaryQuery.data?.totals.improved_proxy_count || 0,
    activeAlerts: patients.filter(p => ['Kritik', 'Çok Kritik'].includes(p.risk_level)).length,
    averageRisk: summaryQuery.data?.averages.risk_score || 0,
    patientsWithAnomalies: summaryQuery.data?.totals.patients_with_anomalies || 0,
    lastAnalysis: summaryQuery.data?.metadata.created_at || new Date().toISOString(),
  };

  // Risk distribution
  const riskDistribution = summaryQuery.data?.risk_distribution || {
    Normal: 0, Dikkat: 0, Kritik: 0, 'Çok Kritik': 0
  };

  return {
    patients,
    kpis,
    summary: summaryQuery.data,
    referenceBand: referenceBandQuery.data,
    riskDistribution,
    isLoading: patientsQuery.isLoading || summaryQuery.isLoading,
    error: patientsQuery.error || summaryQuery.error,
  };
}

// Risk renkleri
export const RISK_COLORS: Record<RiskLevel, string> = {
  'Normal': '#22c55e',
  'Dikkat': '#f59e0b',
  'Kritik': '#f97316',
  'Çok Kritik': '#ef4444',
};

// Get risk color helper
export function getRiskColor(level: RiskLevel): string {
  return RISK_COLORS[level] || '#6b7280';
}
