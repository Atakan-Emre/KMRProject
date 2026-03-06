"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDashboardData,
  RISK_COLORS,
  getRiskColor,
  useCohortTrajectory,
  useLABCohortTrajectory,
  useChannelOverview,
  useDoctorPerformanceReport,
  useAnomalyTrajectory,
  useSystemConfig,
} from "@/hooks/useKimerizmData";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RiskLevel } from "@/types";
import { formatKMR, formatTimeKey, normalizeGender } from "@/utils/formatters";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });
type AnomalyMetric = "kmr" | "kre" | "gfr";

export default function Dashboard() {
  const { patients, kpis, riskDistribution, isLoading, error } = useDashboardData();
  const { data: cohortTrajectory } = useCohortTrajectory();
  const { data: labCohortTrajectory } = useLABCohortTrajectory();
  const { data: anomalyTrajectory } = useAnomalyTrajectory();
  const { data: doctorPerformanceReport } = useDoctorPerformanceReport();
  const { data: channelOverview } = useChannelOverview();
  const { data: systemConfig } = useSystemConfig();
  const router = useRouter();
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel | null>(null);
  const [quickPatientCode, setQuickPatientCode] = useState("");
  const [quickGoError, setQuickGoError] = useState<string | null>(null);
  const [anomalyYScale, setAnomalyYScale] = useState<Record<AnomalyMetric, number>>({
    kmr: 1.0,
    kre: 1.0,
    gfr: 1.0,
  });
  const [anomalyXWindow, setAnomalyXWindow] = useState<Record<AnomalyMetric, number>>({
    kmr: 21,
    kre: 10,
    gfr: 10,
  });
  const [showAnomalyControls, setShowAnomalyControls] = useState<Record<AnomalyMetric, boolean>>({
    kmr: true,
    kre: false,
    gfr: false,
  });

  const kmrMeasurements =
    channelOverview?.coverage?.kmr?.n_measurements ??
    patients.reduce((sum, p) => sum + (p.n_kmr_points || 0), 0);
  const kreMeasurements =
    channelOverview?.coverage?.kre?.n_measurements ??
    patients.reduce((sum, p) => sum + (p.n_kre_points || 0), 0);
  const gfrMeasurements =
    channelOverview?.coverage?.gfr?.n_measurements ??
    patients.reduce((sum, p) => sum + (p.n_gfr_points || 0), 0);
  const totalMeasurements = kmrMeasurements + kreMeasurements + gfrMeasurements;
  const kmrTimepointCount = channelOverview?.coverage?.kmr?.time_keys?.length ?? 0;
  const kreTimepointCount = channelOverview?.coverage?.kre?.time_keys?.length ?? 0;
  const gfrTimepointCount = channelOverview?.coverage?.gfr?.time_keys?.length ?? 0;

  const expectedMeasurements = patients.length * (kmrTimepointCount + kreTimepointCount + gfrTimepointCount);
  const completenessRate = expectedMeasurements > 0 ? (totalMeasurements / expectedMeasurements) * 100 : 0;
  const missingRate = Math.max(0, 100 - completenessRate);

  const safeFixed = (value: number | null | undefined, digits: number): string =>
    typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
  const safePercent = (value: number | null | undefined, digits: number): string =>
    typeof value === "number" && Number.isFinite(value) ? `%${value.toFixed(digits)}` : "-";
  const safeRatioPercent = (value: number | null | undefined, digits: number): string =>
    typeof value === "number" && Number.isFinite(value) ? `%${(value * 100).toFixed(digits)}` : "-";
  const safeSigned = (value: number | null | undefined, digits: number): string => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(digits)}`;
  };
  const calcChangePercent = (initial: number | null | undefined, final: number | null | undefined): number | null => {
    if (
      typeof initial !== "number" ||
      typeof final !== "number" ||
      !Number.isFinite(initial) ||
      !Number.isFinite(final) ||
      Math.abs(initial) < 1e-9
    ) {
      return null;
    }
    return ((final - initial) / Math.abs(initial)) * 100;
  };

  const hasTrajectory = Array.isArray(cohortTrajectory?.trajectory) && cohortTrajectory.trajectory.length > 0;
  const hasLabTrajectory = Array.isArray(labCohortTrajectory?.trajectory) && labCohortTrajectory.trajectory.length > 0;
  const hasAnomalyTrajectory = Boolean(
    anomalyTrajectory &&
      (
        (anomalyTrajectory.kmr.points?.length ?? 0) > 0 ||
        (anomalyTrajectory.kre.points?.length ?? 0) > 0 ||
        (anomalyTrajectory.gfr.points?.length ?? 0) > 0
      ),
  );

  const kmrAllPoints = anomalyTrajectory?.kmr?.points ?? [];
  const kmrAnomalyPoints = kmrAllPoints.filter((p) => p.anomaly_flag);
  const kreAllPoints = anomalyTrajectory?.kre?.points ?? [];
  const kreAnomalyPoints = kreAllPoints.filter((p) => p.anomaly_flag);
  const gfrAllPoints = anomalyTrajectory?.gfr?.points ?? [];
  const gfrAnomalyPoints = gfrAllPoints.filter((p) => p.anomaly_flag);

  const kmrAnomalyChartMax = Math.max(
    0,
    ...kmrAllPoints.map((p) => p.value),
    ...kmrAnomalyPoints.map((p) => p.value),
    ...(hasTrajectory ? cohortTrajectory!.trajectory.map((t) => t.bound_upper) : []),
    2,
  );
  const kreAnomalyChartMax = Math.max(
    0,
    ...kreAllPoints.map((p) => p.value),
    ...kreAnomalyPoints.map((p) => p.value),
    ...(hasLabTrajectory ? labCohortTrajectory!.trajectory.map((t) => t.bound_kre_upper) : []),
    systemConfig?.clinical_thresholds?.kre?.very_bad_gt ?? 4.5,
  );
  const gfrAnomalyChartMax = Math.max(
    0,
    ...gfrAllPoints.map((p) => p.value),
    ...gfrAnomalyPoints.map((p) => p.value),
    ...(hasLabTrajectory ? labCohortTrajectory!.trajectory.map((t) => t.bound_gfr_upper) : []),
    systemConfig?.clinical_thresholds?.gfr?.very_good_ge ?? 90,
  );

  const kmrXAxisKeys = hasTrajectory
    ? cohortTrajectory!.trajectory.map((t) => t.time_key)
    : Array.from(new Set(kmrAllPoints.map((p) => p.time_key)));
  const kreXAxisKeys = hasLabTrajectory
    ? labCohortTrajectory!.trajectory.map((t) => t.time_key)
    : Array.from(new Set(kreAllPoints.map((p) => p.time_key)));
  const gfrXAxisKeys = hasLabTrajectory
    ? labCohortTrajectory!.trajectory.map((t) => t.time_key)
    : Array.from(new Set(gfrAllPoints.map((p) => p.time_key)));

  const buildCategoryRange = (keys: string[], windowSize: number): [string, string] | undefined => {
    if (!keys.length) return undefined;
    const normalizedWindow = Math.max(2, Math.min(windowSize, keys.length));
    if (normalizedWindow >= keys.length) return undefined;
    return [keys[keys.length - normalizedWindow], keys[keys.length - 1]];
  };

  const kmrXRange = buildCategoryRange(kmrXAxisKeys, anomalyXWindow.kmr);
  const kreXRange = buildCategoryRange(kreXAxisKeys, anomalyXWindow.kre);
  const gfrXRange = buildCategoryRange(gfrXAxisKeys, anomalyXWindow.gfr);

  const adjustAnomalyYScale = (metric: AnomalyMetric, delta: number) => {
    setAnomalyYScale((prev) => {
      const next = Math.min(3.0, Math.max(0.8, prev[metric] + delta));
      return { ...prev, [metric]: Number(next.toFixed(2)) };
    });
  };

  const resetAnomalyYScale = (metric: AnomalyMetric) => {
    setAnomalyYScale((prev) => ({ ...prev, [metric]: 1.0 }));
  };

  const adjustAnomalyXWindow = (metric: AnomalyMetric, delta: number, totalPoints: number) => {
    setAnomalyXWindow((prev) => {
      const minWindow = Math.min(4, Math.max(2, totalPoints));
      const maxWindow = Math.max(minWindow, totalPoints);
      const next = Math.min(maxWindow, Math.max(minWindow, prev[metric] + delta));
      return { ...prev, [metric]: next };
    });
  };

  const resetAnomalyXWindow = (metric: AnomalyMetric, totalPoints: number) => {
    setAnomalyXWindow((prev) => ({ ...prev, [metric]: Math.max(2, totalPoints) }));
  };

  const openAnomalyFullscreen = (metric: AnomalyMetric) => {
    const container = document.getElementById(`anomaly-${metric}-container`) as HTMLElement | null;
    if (container && typeof container.requestFullscreen === "function") {
      container.requestFullscreen().catch(() => undefined);
    }
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportAnomalyPlot = async (metric: AnomalyMetric, format: "jpeg" | "pdf") => {
    try {
      const plotId = `anomaly-${metric}-plot`;
      const plotElement = document.getElementById(plotId) as unknown as HTMLDivElement | null;
      if (!plotElement) {
        return;
      }

      const plotlyModule = await import("plotly.js-dist-min");
      const Plotly = plotlyModule.default;
      const imageData = await Plotly.toImage(plotElement, {
        format: "jpeg",
        width: 2200,
        height: 1200,
        scale: 2,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      if (format === "jpeg") {
        downloadDataUrl(imageData, `anomaly_${metric}_${timestamp}.jpeg`);
        return;
      }

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
      pdf.save(`anomaly_${metric}_${timestamp}.pdf`);
    } catch (err) {
      console.error("Anomali grafik export hatası:", err);
    }
  };

  const kmrLastIqrWidth = hasTrajectory
    ? (cohortTrajectory!.trajectory[cohortTrajectory!.trajectory.length - 1].iqr_upper -
      cohortTrajectory!.trajectory[cohortTrajectory!.trajectory.length - 1].iqr_lower)
    : null;
  const kreLastIqrWidth = hasLabTrajectory
    ? (labCohortTrajectory!.trajectory[labCohortTrajectory!.trajectory.length - 1].iqr_kre_upper -
      labCohortTrajectory!.trajectory[labCohortTrajectory!.trajectory.length - 1].iqr_kre_lower)
    : null;
  const gfrLastIqrWidth = hasLabTrajectory
    ? (labCohortTrajectory!.trajectory[labCohortTrajectory!.trajectory.length - 1].iqr_gfr_upper -
      labCohortTrajectory!.trajectory[labCohortTrajectory!.trajectory.length - 1].iqr_gfr_lower)
    : null;
  const kreMedianChangePercent = calcChangePercent(
    labCohortTrajectory?.summary?.initial_kre_median,
    labCohortTrajectory?.summary?.final_kre_median,
  );
  const gfrMedianChangePercent = calcChangePercent(
    labCohortTrajectory?.summary?.initial_gfr_median,
    labCohortTrajectory?.summary?.final_gfr_median,
  );
  const doctorMetrics = doctorPerformanceReport?.summary?.metrics;

  const patientsWithAgeKmr = patients.filter(
    (p) => p.age !== null && p.age !== undefined && p.last_kmr !== null && p.last_kmr !== undefined,
  );
  // Demografik hesaplamalar - normalizeGender ile tüm varyasyonları standartlaştır
  const malePatients = patients.filter(p => normalizeGender(p.gender) === 'Erkek');
  const femalePatients = patients.filter(p => normalizeGender(p.gender) === 'Kadın');
  const unknownGenderPatients = patients.filter(p => normalizeGender(p.gender) === 'Bilinmiyor');
  
  const demographics = {
    genderCounts: {
      male: malePatients.length,
      female: femalePatients.length,
      unknown: unknownGenderPatients.length
    },
    ageGroups: {
      '0-20': patients.filter(p => p.age && p.age <= 20).length,
      '21-40': patients.filter(p => p.age && p.age > 20 && p.age <= 40).length,
      '41-60': patients.filter(p => p.age && p.age > 40 && p.age <= 60).length,
      '60+': patients.filter(p => p.age && p.age > 60).length,
    },
    improvedByGender: {
      male: malePatients.filter(p => p.improved_proxy).length,
      female: femalePatients.filter(p => p.improved_proxy).length,
    },
    avgRiskByGender: {
      male: malePatients.length > 0 ? malePatients.reduce((s, p) => s + p.risk_score, 0) / malePatients.length : 0,
      female: femalePatients.length > 0 ? femalePatients.reduce((s, p) => s + p.risk_score, 0) / femalePatients.length : 0,
    }
  };

  const filteredPatients = selectedRiskLevel 
    ? patients.filter(p => p.risk_level === selectedRiskLevel)
    : patients;

  const criticalPatients = [...patients]
    .filter((p) => p.risk_level === "Kritik" || p.risk_level === "Çok Kritik")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  const topRiskPatients = [...patients]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  const priorityPatients = criticalPatients.length > 0 ? criticalPatients : topRiskPatients;

  const patientsWithRiskDelta = patients.filter(
    (p) => typeof p.risk_delta === "number" && Number.isFinite(p.risk_delta),
  );
  const worseningPatients = [...patientsWithRiskDelta]
    .filter((p) => (p.risk_delta ?? 0) > 0)
    .sort((a, b) => (b.risk_delta ?? 0) - (a.risk_delta ?? 0))
    .slice(0, 5);
  const improvingPatients = [...patientsWithRiskDelta]
    .filter((p) => (p.risk_delta ?? 0) < 0)
    .sort((a, b) => (a.risk_delta ?? 0) - (b.risk_delta ?? 0))
    .slice(0, 5);

  const kmrAnomalyCount = patients.filter((p) => p.kmr_has_anomaly).length;
  const kreAnomalyCount = patients.filter((p) => p.kre_has_anomaly).length;
  const gfrAnomalyCount = patients.filter((p) => p.gfr_has_anomaly).length;

  const kmrCriticalThresholdCount = patients.filter((p) => p.kmr_threshold_breach).length;
  const kreCriticalThresholdCount = patients.filter((p) => p.kre_threshold_breach).length;
  const gfrCriticalThresholdCount = patients.filter((p) => p.gfr_threshold_breach).length;

  const actionablePatients = [...patients]
    .filter(
      (p) =>
        p.risk_level === "Kritik" ||
        p.risk_level === "Çok Kritik" ||
        p.has_anomaly ||
        (p.last_kmr !== null && p.last_kmr > 5) ||
        (p.last_kre !== null && p.last_kre > 4.5) ||
        (p.last_gfr !== null && p.last_gfr < 15),
    )
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 8);

  const latestMeasurement = patients.reduce(
    (best, p) => {
      const candidates = [
        { order: p.last_measurement_time_order, key: p.last_measurement_time_key },
        { order: p.last_kmr_time_order, key: p.last_kmr_time_key },
        { order: p.last_kre_time_order, key: p.last_kre_time_key },
        { order: p.last_gfr_time_order, key: p.last_gfr_time_key },
      ].filter((c) => c.order !== null && c.order !== undefined && c.key);

      if (candidates.length === 0) {
        return best;
      }

      const localMax = candidates.reduce((a, b) => ((a.order as number) >= (b.order as number) ? a : b));
      if ((localMax.order as number) > best.order) {
        return { order: localMax.order as number, key: localMax.key as string };
      }
      return best;
    },
    { order: -1, key: null as string | null },
  );

  const handleQuickGo = () => {
    const normalized = quickPatientCode.trim().toUpperCase();
    if (!normalized) {
      setQuickGoError("Hasta kodu girin.");
      return;
    }
    const patient = patients.find((p) => p.patient_code.toUpperCase() === normalized);
    if (!patient) {
      setQuickGoError("Hasta bulunamadı.");
      return;
    }
    setQuickGoError(null);
    router.push(`/patients/${patient.patient_code}`);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-lg font-medium">Veri yükleme hatası</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Bilinmeyen hata'}
          </p>
          <Button className="mt-4" onClick={() => window.location.reload()} variant="outline">
            Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ana Sayfa</h1>
          <p className="text-muted-foreground">
            Non invasive screening of transplatation health (NISTH)
          </p>
        </div>
        <Link href="/patients">
          <Button>Hastalara Git</Button>
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
        ⚠️ <strong>Uyarı:</strong> Bu sistem karar destek amaçlıdır. Klinik kararlar uzman hekim değerlendirmesi ile alınmalıdır.
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Toplam Hasta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalPatients}</div>
            <p className="text-xs text-muted-foreground">Aktif takip</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">İyileşmiş Hasta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{kpis.improvedCount}</div>
            <p className="text-xs text-muted-foreground">9+ ay takipli</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aktif Uyarı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpis.activeAlerts}</div>
            <p className="text-xs text-muted-foreground">Kritik/Çok Kritik</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ortalama Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.averageRisk.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Skor (0-100)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Anomali Tespiti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{kpis.patientsWithAnomalies}</div>
            <p className="text-xs text-muted-foreground">Anomalili hasta</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="demographics">Demografik</TabsTrigger>
          <TabsTrigger value="cohort">Hasta Seyri (AI)</TabsTrigger>
          <TabsTrigger value="anomaly">Anomali Seyri</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Hızlı Hasta Geçişi</CardTitle>
              <CardDescription>Kodu girip doğrudan hasta detayına geçin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Örn: AB"
                  value={quickPatientCode}
                  onChange={(e) => {
                    setQuickPatientCode(e.target.value.toUpperCase());
                    if (quickGoError) setQuickGoError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleQuickGo();
                    }
                  }}
                />
                <Button onClick={handleQuickGo}>Git</Button>
              </div>
              {quickGoError && (
                <p className="mt-2 text-xs text-red-600">{quickGoError}</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Risk Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Dağılımı</CardTitle>
                <CardDescription>Hasta risk kategorileri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Plot
                    data={[{
                      values: Object.values(riskDistribution),
                      labels: Object.keys(riskDistribution),
                      type: 'pie',
                      marker: {
                        colors: Object.keys(riskDistribution).map(l => RISK_COLORS[l as RiskLevel])
                      },
                      textinfo: 'label+percent',
                      hoverinfo: 'label+value+percent'
                    }]}
                    layout={{
                      showlegend: false,
                      margin: { t: 20, b: 20, l: 20, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)'
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Risk Category Buttons */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Risk Kategorileri</CardTitle>
                <CardDescription>Kategoriye tıklayarak filtreleyin</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {(Object.entries(riskDistribution) as [RiskLevel, number][]).map(([level, count]) => (
                    <button
                      key={level}
                      onClick={() => setSelectedRiskLevel(selectedRiskLevel === level ? null : level)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedRiskLevel === level ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
                        <span className="font-medium text-sm">{level}</span>
                      </div>
                      <div className="text-lg font-bold">{count} hasta</div>
                      <div className="text-xs text-muted-foreground">
                        %{patients.length > 0 ? ((count / patients.length) * 100).toFixed(1) : 0}
                      </div>
                    </button>
                  ))}
                </div>

                {selectedRiskLevel && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedRiskLevel(null)}>
                    Filtreyi Temizle
                  </Button>
                )}

                {/* Filtered Patient Mini List */}
                <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
                  {filteredPatients.slice(0, 8).map(p => (
                    <div key={p.patient_code} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getRiskColor(p.risk_level) }} />
                        <span className="font-medium">Hasta {p.patient_code}</span>
                      </div>
                      <div className="text-sm text-right">
                        <div>KMR: {formatKMR(p.last_kmr)}</div>
                        <div className="text-xs text-muted-foreground">Risk: {p.risk_score.toFixed(1)}</div>
                      </div>
                      <Link href={`/patients/${p.patient_code}`}>
                        <Button variant="ghost" size="sm">→</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Anomali Özeti</CardTitle>
                <CardDescription>Metrik bazında anomalili hasta dağılımı</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">KMR Anomali</span>
                  <span className="text-sm font-medium">{kmrAnomalyCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">KRE Anomali</span>
                  <span className="text-sm font-medium">{kreAnomalyCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">GFR Anomali</span>
                  <span className="text-sm font-medium">{gfrAnomalyCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Klinik Eşik İhlalleri</CardTitle>
                <CardDescription>Tüm takip boyunca en az bir eşik ihlali görülen hastalar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">KMR &gt; 5</span>
                  <span className="text-sm font-medium text-red-600">{kmrCriticalThresholdCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">KRE &gt; 4.5</span>
                  <span className="text-sm font-medium text-red-600">{kreCriticalThresholdCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">GFR &lt; 15</span>
                  <span className="text-sm font-medium text-red-600">{gfrCriticalThresholdCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bugün İncelenecekler</CardTitle>
                <CardDescription>Öncelikli takip listesi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-52 overflow-y-auto">
                {actionablePatients.length > 0 ? (
                  actionablePatients.map((p) => (
                    <div key={`action-${p.patient_code}`} className="flex items-center justify-between text-sm">
                      <Link href={`/patients/${p.patient_code}`} className="font-medium hover:underline">
                        Hasta {p.patient_code}
                      </Link>
                      <span style={{ color: getRiskColor(p.risk_level) }}>
                        {p.risk_level} ({p.risk_score.toFixed(1)})
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Öncelikli hasta bulunmuyor.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Kritik Hastalar (İlk 5)</CardTitle>
                <CardDescription>Risk skoru en yüksek öncelikli hastalar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {priorityPatients.map((p) => (
                  <div key={`critical-${p.patient_code}`} className="rounded border p-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/patients/${p.patient_code}`} className="font-medium hover:underline">
                        Hasta {p.patient_code}
                      </Link>
                      <span className="text-xs" style={{ color: getRiskColor(p.risk_level) }}>
                        {p.risk_level}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Risk: {p.risk_score.toFixed(1)} • KMR: {formatKMR(p.last_kmr)} • KRE: {p.last_kre?.toFixed(2) ?? "-"} • GFR: {p.last_gfr?.toFixed(0) ?? "-"}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Risk Değişim Özeti</CardTitle>
                <CardDescription>Son iki ölçüm noktası arasındaki değişim</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-red-600">En Çok Artan Risk</p>
                  <div className="space-y-2">
                    {worseningPatients.length > 0 ? (
                      worseningPatients.map((p) => (
                        <div key={`worse-${p.patient_code}`} className="flex items-center justify-between text-sm">
                          <Link href={`/patients/${p.patient_code}`} className="hover:underline">Hasta {p.patient_code}</Link>
                          <span className="font-medium text-red-600">{safeSigned(p.risk_delta, 1)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Artış verisi bulunamadı.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-green-600">En Çok Azalan Risk</p>
                  <div className="space-y-2">
                    {improvingPatients.length > 0 ? (
                      improvingPatients.map((p) => (
                        <div key={`improve-${p.patient_code}`} className="flex items-center justify-between text-sm">
                          <Link href={`/patients/${p.patient_code}`} className="hover:underline">Hasta {p.patient_code}</Link>
                          <span className="font-medium text-green-600">{safeSigned(p.risk_delta, 1)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Azalış verisi bulunamadı.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Updates */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Son Güncellemeler</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Referans bandı güncellendi</p>
                      <p className="text-xs text-muted-foreground">{kpis.improvedCount} iyileşmiş hasta</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-sm font-medium">LSTM + VAE modeli aktif</p>
                      <p className="text-xs text-muted-foreground">KMR tahmin ve anomali tespiti</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <div>
                      <p className="text-sm font-medium">KRE/GFR entegrasyonu</p>
                      <p className="text-xs text-muted-foreground">Klinik lab değerleri risk skoruna dahil</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sistem Durumu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">LSTM Model</span>
                    <span className="text-green-600 text-sm font-medium">✓ Aktif</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Anomali Dedektörü</span>
                    <span className="text-green-600 text-sm font-medium">✓ Aktif</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Risk Skorlama</span>
                    <span className="text-green-600 text-sm font-medium">✓ Aktif</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Son Analiz</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(kpis.lastAnalysis).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">KMR Ölçüm</span>
                    <span className="text-sm text-muted-foreground">{kmrMeasurements}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">KRE Ölçüm</span>
                    <span className="text-sm text-muted-foreground">{kreMeasurements}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">GFR Ölçüm</span>
                    <span className="text-sm text-muted-foreground">{gfrMeasurements}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Toplam Ölçüm</span>
                    <span className="text-sm text-muted-foreground">{totalMeasurements}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Son Veri Noktası</span>
                    <span className="text-sm text-muted-foreground">
                      {latestMeasurement.key ? formatTimeKey(latestMeasurement.key) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Model</span>
                    <span className="text-sm text-muted-foreground">
                      {cohortTrajectory?.metadata?.model || "LSTM + VAE"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pipeline Sürümü</span>
                    <span className="text-sm text-muted-foreground">
                      {systemConfig?.metadata?.schema_version || "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Veri Kalitesi</CardTitle>
                <CardDescription>Ölçüm doluluğu ve veri kapsamı</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Toplam Doluluk</span>
                  <span className="text-sm font-medium">{completenessRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Eksik Ölçüm</span>
                  <span className="text-sm text-muted-foreground">{missingRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">KMR Kanal</span>
                  <span className="text-sm text-muted-foreground">
                    {patients.length > 0 && kmrTimepointCount > 0
                      ? `%${((kmrMeasurements / (patients.length * kmrTimepointCount)) * 100).toFixed(1)}`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">KRE Kanal</span>
                  <span className="text-sm text-muted-foreground">
                    {patients.length > 0 && kreTimepointCount > 0
                      ? `${((kreMeasurements / (patients.length * kreTimepointCount)) * 100).toFixed(1)}%`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">GFR Kanal</span>
                  <span className="text-sm text-muted-foreground">
                    {patients.length > 0 && gfrTimepointCount > 0
                      ? `${((gfrMeasurements / (patients.length * gfrTimepointCount)) * 100).toFixed(1)}%`
                      : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Gender Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Cinsiyet Dağılımı</CardTitle>
                <CardDescription>Hasta cinsiyet oranları</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Plot
                    data={[{
                      values: [demographics.genderCounts.male, demographics.genderCounts.female, demographics.genderCounts.unknown],
                      labels: ['Erkek', 'Kadın', 'Belirtilmemiş'],
                      type: 'pie',
                      marker: { colors: ['#3b82f6', '#ec4899', '#9ca3af'] },
                      textinfo: 'label+percent',
                      hole: 0.4
                    }]}
                    layout={{ showlegend: false, margin: { t: 20, b: 20, l: 20, r: 20 }, paper_bgcolor: 'rgba(0,0,0,0)' }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Age Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Yaş Dağılımı</CardTitle>
                <CardDescription>Yaş gruplarına göre hasta sayısı</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Plot
                    data={[{
                      x: Object.keys(demographics.ageGroups),
                      y: Object.values(demographics.ageGroups),
                      type: 'bar',
                      marker: { color: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'] },
                      text: Object.values(demographics.ageGroups).map(String),
                      textposition: 'auto'
                    }]}
                    layout={{
                      xaxis: { title: 'Yaş Grubu' },
                      yaxis: { title: 'Hasta Sayısı' },
                      margin: { t: 20, b: 50, l: 40, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)'
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Improvement by Gender */}
            <Card>
              <CardHeader>
                <CardTitle>Cinsiyete Göre İyileşme</CardTitle>
                <CardDescription>9+ ay takipli iyileşmiş hastalar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Plot
                    data={[
                      { x: ['Erkek', 'Kadın'], y: [demographics.genderCounts.male, demographics.genderCounts.female], name: 'Toplam', type: 'bar', marker: { color: '#94a3b8' } },
                      { x: ['Erkek', 'Kadın'], y: [demographics.improvedByGender.male, demographics.improvedByGender.female], name: 'İyileşmiş', type: 'bar', marker: { color: '#22c55e' } }
                    ]}
                    layout={{
                      barmode: 'group',
                      xaxis: { title: '' },
                      yaxis: { title: 'Hasta Sayısı' },
                      margin: { t: 20, b: 40, l: 40, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      legend: { orientation: 'h', y: -0.15 }
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
                <div className="mt-2 text-sm text-center">
                  <span className="text-blue-600">Erkek iyileşme: {demographics.genderCounts.male > 0 ? ((demographics.improvedByGender.male / demographics.genderCounts.male) * 100).toFixed(1) : 0}%</span>
                  {' • '}
                  <span className="text-pink-600">Kadın iyileşme: {demographics.genderCounts.female > 0 ? ((demographics.improvedByGender.female / demographics.genderCounts.female) * 100).toFixed(1) : 0}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Risk by Gender */}
            <Card>
              <CardHeader>
                <CardTitle>Cinsiyete Göre Ortalama Risk</CardTitle>
                <CardDescription>Risk skoru karşılaştırması</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Plot
                    data={[{
                      x: ['Erkek', 'Kadın'],
                      y: [demographics.avgRiskByGender.male, demographics.avgRiskByGender.female],
                      type: 'bar',
                      marker: { color: ['#3b82f6', '#ec4899'] },
                      text: [demographics.avgRiskByGender.male.toFixed(1), demographics.avgRiskByGender.female.toFixed(1)],
                      textposition: 'auto'
                    }]}
                    layout={{
                      xaxis: { title: '' },
                      yaxis: { title: 'Ortalama Risk Skoru', range: [0, 100] },
                      margin: { t: 20, b: 40, l: 50, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)'
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Age vs KMR Scatter */}
            <Card>
              <CardHeader>
                <CardTitle>Yaş - KMR İlişkisi</CardTitle>
                <CardDescription>Yaşa göre son KMR değerleri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Plot
                    data={[{
                      x: patientsWithAgeKmr.map((p) => p.age),
                      y: patientsWithAgeKmr.map((p) => p.last_kmr),
                      mode: 'markers',
                      type: 'scatter',
                      marker: {
                        size: 10,
                        color: patientsWithAgeKmr.map(p => 
                          normalizeGender(p.gender) === 'Erkek' ? '#3b82f6' : normalizeGender(p.gender) === 'Kadın' ? '#ec4899' : '#9ca3af'
                        ),
                        opacity: 0.7
                      },
                      text: patientsWithAgeKmr.map((p) => p.patient_code),
                      hovertemplate: '<b>%{text}</b><br>Yaş: %{x}<br>KMR: %%{y:.3f}<extra></extra>'
                    }]}
                    layout={{
                      xaxis: { title: 'Yaş' },
                      yaxis: { title: 'Son KMR (%)', type: 'log' },
                      margin: { t: 20, b: 50, l: 50, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)'
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
                <div className="mt-1 text-xs text-center text-muted-foreground">
                  🔵 Erkek • 🩷 Kadın
                </div>
              </CardContent>
            </Card>

            {/* Risk Level by Age Group */}
            <Card>
              <CardHeader>
                <CardTitle>Yaş Grubuna Göre Risk Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Plot
                    data={['Normal', 'Dikkat', 'Kritik', 'Çok Kritik'].map(level => ({
                      x: ['0-20', '21-40', '41-60', '60+'],
                      y: [
                        patients.filter(p => p.age && p.age <= 20 && p.risk_level === level).length,
                        patients.filter(p => p.age && p.age > 20 && p.age <= 40 && p.risk_level === level).length,
                        patients.filter(p => p.age && p.age > 40 && p.age <= 60 && p.risk_level === level).length,
                        patients.filter(p => p.age && p.age > 60 && p.risk_level === level).length,
                      ],
                      name: level,
                      type: 'bar',
                      marker: { color: RISK_COLORS[level as RiskLevel] }
                    }))}
                    layout={{
                      barmode: 'stack',
                      xaxis: { title: 'Yaş Grubu' },
                      yaxis: { title: 'Hasta Sayısı' },
                      margin: { t: 20, b: 50, l: 40, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      legend: { orientation: 'h', y: -0.2 }
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cohort Trajectory Tab */}
        <TabsContent value="cohort" className="space-y-6">
          {cohortTrajectory && hasTrajectory ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">İyileşmiş Hasta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">{cohortTrajectory?.metadata?.n_patients ?? 0}</div>
                    <p className="text-xs text-green-600">Referans hasta grubu</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Başlangıç KMR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">{safePercent(cohortTrajectory?.summary?.initial_kmr_median, 2)}</div>
                    <p className="text-xs text-blue-600">Median Day_1</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Son KMR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-700">{safePercent(cohortTrajectory?.summary?.final_kmr_median, 3)}</div>
                    <p className="text-xs text-purple-600">Median Month_12</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam Düşüş</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-700">{safePercent(cohortTrajectory?.summary?.reduction_percent, 1)}</div>
                    <p className="text-xs text-orange-600">Stabil: {cohortTrajectory?.summary?.time_to_stable || '-'}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Main Trajectory Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>🧠 İyileşmiş Hasta KMR Seyri</CardTitle>
                  <CardDescription>
                    {cohortTrajectory?.metadata?.n_patients ?? 0} hastanın <strong>LSTM + VAE (Variational Autoencoder)</strong> modelleri ile hesaplanan beklenen seyri
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <Plot
                      data={[
                        // Confidence band (P10-P90)
                        {
                          x: [...cohortTrajectory.trajectory.map(t => t.time_key), ...cohortTrajectory.trajectory.slice().reverse().map(t => t.time_key)],
                          y: [...cohortTrajectory.trajectory.map(t => t.bound_upper), ...cohortTrajectory.trajectory.slice().reverse().map(t => t.bound_lower)],
                          fill: 'toself',
                          fillcolor: 'rgba(59, 130, 246, 0.15)',
                          line: { color: 'transparent' },
                          name: 'P10-P90 Aralığı',
                          showlegend: true,
                          hoverinfo: 'skip',
                          type: 'scatter'
                        },
                        // IQR band (P25-P75)
                        {
                          x: [...cohortTrajectory.trajectory.map(t => t.time_key), ...cohortTrajectory.trajectory.slice().reverse().map(t => t.time_key)],
                          y: [...cohortTrajectory.trajectory.map(t => t.iqr_upper), ...cohortTrajectory.trajectory.slice().reverse().map(t => t.iqr_lower)],
                          fill: 'toself',
                          fillcolor: 'rgba(34, 197, 94, 0.2)',
                          line: { color: 'transparent' },
                          name: 'IQR (P25-P75)',
                          showlegend: true,
                          hoverinfo: 'skip',
                          type: 'scatter'
                        },
                        // Expected (LSTM)
                        {
                          x: cohortTrajectory.trajectory.map(t => t.time_key),
                          y: cohortTrajectory.trajectory.map(t => t.expected_kmr),
                          mode: 'lines+markers',
                          name: 'AI Tahmini (LSTM)',
                          line: { color: '#3b82f6', width: 3 },
                          marker: { size: 8 },
                          type: 'scatter'
                        },
                        // Cohort Median
                        {
                          x: cohortTrajectory.trajectory.map(t => t.time_key),
                          y: cohortTrajectory.trajectory.map(t => t.cohort_median),
                          mode: 'lines+markers',
                          name: 'Gerçek Hasta Medyan',
                          line: { color: '#22c55e', width: 2, dash: 'dash' },
                          marker: { size: 6 },
                          type: 'scatter'
                        }
                      ]}
                      layout={{
                        xaxis: { title: 'Zaman Noktası', tickangle: -45 },
                        yaxis: { title: 'KMR (%)', rangemode: 'tozero' },
                        margin: { t: 30, b: 100, l: 60, r: 30 },
                        legend: { orientation: 'h', y: 1.1 },
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        shapes: [
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0.5, y1: 0.5, line: { color: '#f59e0b', width: 1, dash: 'dot' } },
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 2, y1: 2, line: { color: '#ef4444', width: 1, dash: 'dot' } }
                        ],
                        annotations: [
                          { x: 0.02, xref: 'paper', y: 0.5, text: '0.5% dikkat', showarrow: false, font: { size: 10, color: '#f59e0b' } },
                          { x: 0.02, xref: 'paper', y: 2, text: '2% kritik', showarrow: false, font: { size: 10, color: '#ef4444' } }
                        ]
                      }}
                      config={{ responsive: true, displayModeBar: false }}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p>🔵 <strong>AI Tahmini (LSTM):</strong> Yapay zeka modelinin öğrendiği tipik iyileşme eğrisi</p>
                    <p>🟢 <strong>Gerçek Hasta Medyan:</strong> İyileşmiş hastaların gerçek medyan değerleri</p>
                    <p>Gölgeli alanlar güven aralıklarını gösterir (açık mavi: P10-P90, yeşil: IQR)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Time-based breakdown */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Günlük Dönem (1-7. Gün)</CardTitle>
                    <CardDescription>İlk hafta KMR değişimi - Akut faz</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <Plot
                        data={[{
                          x: cohortTrajectory.trajectory.filter(t => t.time_key.startsWith('Day')).map(t => t.time_key),
                          y: cohortTrajectory.trajectory.filter(t => t.time_key.startsWith('Day')).map(t => t.cohort_median),
                          type: 'scatter',
                          mode: 'lines+markers',
                          line: { color: '#3b82f6', width: 2 },
                          marker: { size: 10 },
                          fill: 'tozeroy',
                          fillcolor: 'rgba(59, 130, 246, 0.2)'
                        }]}
                        layout={{
                          xaxis: { title: 'Gün' },
                          yaxis: { title: 'Median KMR (%)' },
                          margin: { t: 20, b: 50, l: 50, r: 20 },
                          paper_bgcolor: 'rgba(0,0,0,0)'
                        }}
                        config={{ responsive: true, displayModeBar: false }}
                        className="w-full h-full"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Haftalık/Aylık Dönem</CardTitle>
                    <CardDescription>Uzun dönem KMR değişimi - Konsolidasyon fazı</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <Plot
                        data={[{
                          x: cohortTrajectory.trajectory.filter(t => t.time_key.startsWith('Week') || t.time_key.startsWith('Month')).map(t => t.time_key),
                          y: cohortTrajectory.trajectory.filter(t => t.time_key.startsWith('Week') || t.time_key.startsWith('Month')).map(t => t.cohort_median),
                          type: 'scatter',
                          mode: 'lines+markers',
                          line: { color: '#22c55e', width: 2 },
                          marker: { size: 10 },
                          fill: 'tozeroy',
                          fillcolor: 'rgba(34, 197, 94, 0.2)'
                        }]}
                        layout={{
                          xaxis: { title: 'Zaman', tickangle: -45 },
                          yaxis: { title: 'Median KMR (%)' },
                          margin: { t: 20, b: 80, l: 50, r: 20 },
                          paper_bgcolor: 'rgba(0,0,0,0)'
                        }}
                        config={{ responsive: true, displayModeBar: false }}
                        className="w-full h-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-sky-50 to-sky-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">KRE Medyan Değişimi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-sky-700">
                      {safeFixed(labCohortTrajectory?.summary?.initial_kre_median, 2)} → {safeFixed(labCohortTrajectory?.summary?.final_kre_median, 2)}
                    </div>
                    <p className="text-xs text-sky-700">
                      Değişim: {safeSigned(kreMedianChangePercent, 1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">GFR Medyan Değişimi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-cyan-700">
                      {safeFixed(labCohortTrajectory?.summary?.initial_gfr_median, 1)} → {safeFixed(labCohortTrajectory?.summary?.final_gfr_median, 1)}
                    </div>
                    <p className="text-xs text-cyan-700">
                      Değişim: {safeSigned(gfrMedianChangePercent, 1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Son IQR Genişliği</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-emerald-800 space-y-1">
                      <p>KMR: {safeFixed(kmrLastIqrWidth, 3)}</p>
                      <p>KRE: {safeFixed(kreLastIqrWidth, 3)}</p>
                      <p>GFR: {safeFixed(gfrLastIqrWidth, 2)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>🧪 KRE/GFR Hasta Seyri (AI)</CardTitle>
                  <CardDescription>
                    KRE ve GFR için beklenen değer, cohort medyanı, IQR ve geniş güven bantları dinamik gösterilir.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasLabTrajectory ? (
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="h-80">
                        <Plot
                          data={[
                            {
                              x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                              y: [...labCohortTrajectory!.trajectory.map((t) => t.bound_kre_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.bound_kre_lower)],
                              fill: 'toself',
                              fillcolor: 'rgba(14, 165, 233, 0.14)',
                              line: { color: 'transparent' },
                              name: 'KRE P10-P90',
                              type: 'scatter',
                              hoverinfo: 'skip',
                              showlegend: true,
                            },
                            {
                              x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                              y: [...labCohortTrajectory!.trajectory.map((t) => t.iqr_kre_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.iqr_kre_lower)],
                              fill: 'toself',
                              fillcolor: 'rgba(2, 132, 199, 0.20)',
                              line: { color: 'transparent' },
                              name: 'KRE IQR',
                              type: 'scatter',
                              hoverinfo: 'skip',
                              showlegend: true,
                            },
                            {
                              x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                              y: labCohortTrajectory!.trajectory.map((t) => t.expected_kre),
                              mode: 'lines+markers',
                              name: 'KRE AI Tahmini',
                              line: { color: '#0284c7', width: 3 },
                              marker: { size: 6 },
                              type: 'scatter',
                            },
                            {
                              x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                              y: labCohortTrajectory!.trajectory.map((t) => t.cohort_kre_median),
                              mode: 'lines+markers',
                              name: 'KRE Cohort Medyan',
                              line: { color: '#075985', width: 2, dash: 'dash' },
                              marker: { size: 5 },
                              type: 'scatter',
                            },
                          ]}
                          layout={{
                            title: { text: 'KRE Seyri', font: { size: 14 } },
                            xaxis: { title: 'Zaman', tickangle: -35 },
                            yaxis: { title: 'KRE' },
                            margin: { t: 40, b: 80, l: 55, r: 20 },
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            shapes: [
                              { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.kre?.very_good_lt ?? 1.2, y1: systemConfig?.clinical_thresholds?.kre?.very_good_lt ?? 1.2, line: { color: '#22c55e', width: 1, dash: 'dot' } },
                              { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.kre?.very_bad_gt ?? 4.5, y1: systemConfig?.clinical_thresholds?.kre?.very_bad_gt ?? 4.5, line: { color: '#ef4444', width: 1, dash: 'dot' } },
                            ],
                          }}
                          config={{ responsive: true, displayModeBar: false }}
                          className="w-full h-full"
                        />
                      </div>

                      <div className="h-80">
                        <Plot
                          data={[
                            {
                              x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                              y: [...labCohortTrajectory!.trajectory.map((t) => t.bound_gfr_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.bound_gfr_lower)],
                              fill: 'toself',
                              fillcolor: 'rgba(6, 182, 212, 0.14)',
                              line: { color: 'transparent' },
                              name: 'GFR P10-P90',
                              type: 'scatter',
                              hoverinfo: 'skip',
                              showlegend: true,
                            },
                            {
                              x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                              y: [...labCohortTrajectory!.trajectory.map((t) => t.iqr_gfr_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.iqr_gfr_lower)],
                              fill: 'toself',
                              fillcolor: 'rgba(8, 145, 178, 0.20)',
                              line: { color: 'transparent' },
                              name: 'GFR IQR',
                              type: 'scatter',
                              hoverinfo: 'skip',
                              showlegend: true,
                            },
                            {
                              x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                              y: labCohortTrajectory!.trajectory.map((t) => t.expected_gfr),
                              mode: 'lines+markers',
                              name: 'GFR AI Tahmini',
                              line: { color: '#0891b2', width: 3 },
                              marker: { size: 6 },
                              type: 'scatter',
                            },
                            {
                              x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                              y: labCohortTrajectory!.trajectory.map((t) => t.cohort_gfr_median),
                              mode: 'lines+markers',
                              name: 'GFR Cohort Medyan',
                              line: { color: '#155e75', width: 2, dash: 'dash' },
                              marker: { size: 5 },
                              type: 'scatter',
                            },
                          ]}
                          layout={{
                            title: { text: 'GFR Seyri', font: { size: 14 } },
                            xaxis: { title: 'Zaman', tickangle: -35 },
                            yaxis: { title: 'GFR' },
                            margin: { t: 40, b: 80, l: 55, r: 20 },
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            shapes: [
                              { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.gfr?.very_good_ge ?? 90, y1: systemConfig?.clinical_thresholds?.gfr?.very_good_ge ?? 90, line: { color: '#22c55e', width: 1, dash: 'dot' } },
                              { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.gfr?.very_bad_le ?? 15, y1: systemConfig?.clinical_thresholds?.gfr?.very_bad_le ?? 15, line: { color: '#ef4444', width: 1, dash: 'dot' } },
                            ],
                          }}
                          config={{ responsive: true, displayModeBar: false }}
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      LAB cohort verisi bulunamadı. Yeterli KRE/GFR zaman serisi oluşunca grafikler otomatik dolacaktır.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>📈 Model Performans Özeti</CardTitle>
                  <CardDescription>Doktor paneli performans raporundan dinamik MAE / RMSE / kapsama değerleri</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    {(["kmr", "kre", "gfr"] as const).map((metric) => (
                      <div key={metric} className="rounded border p-3 text-sm">
                        <p className="font-medium uppercase">{metric}</p>
                        <p>Eval Hasta: {doctorMetrics?.[metric]?.patients_with_eval ?? 0}</p>
                        <p>Eval Nokta: {doctorMetrics?.[metric]?.total_eval_points ?? 0}</p>
                        <p>MAE: {safeFixed(doctorMetrics?.[metric]?.mae, metric === "gfr" ? 2 : 3)}</p>
                        <p>RMSE: {safeFixed(doctorMetrics?.[metric]?.rmse, metric === "gfr" ? 2 : 3)}</p>
                        <p>Kapsama: {safeRatioPercent(doctorMetrics?.[metric]?.interval_coverage, 1)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">
                  {cohortTrajectory ? "Hasta seyri verisi bulunamadı." : "Hasta seyri verisi yükleniyor..."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="anomaly" className="space-y-6">
          {hasAnomalyTrajectory ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-red-50 to-red-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam KMR Anomali Noktası</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-700">{kmrAnomalyPoints.length}</div>
                    <p className="text-xs text-red-700">Tüm hastalar / tüm zaman noktaları</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam KRE Anomali Noktası</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-700">{kreAnomalyPoints.length}</div>
                    <p className="text-xs text-amber-700">Tüm hastalar / tüm zaman noktaları</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam GFR Anomali Noktası</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-cyan-700">{gfrAnomalyPoints.length}</div>
                    <p className="text-xs text-cyan-700">Tüm hastalar / tüm zaman noktaları</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Dinamik Veri Durumu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-700">
                      <p>Hasta: {anomalyTrajectory?.metadata?.n_patients ?? 0}</p>
                      <p>Şema: {anomalyTrajectory?.metadata?.schema_version ?? "-"}</p>
                      <p>Güncellendi: {anomalyTrajectory?.metadata?.created_at ? new Date(anomalyTrajectory.metadata.created_at).toLocaleString('tr-TR') : "-"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>🔴 KMR Anomali Seyri (Tüm Hastalar)</CardTitle>
                  <CardDescription>
                    İyileşmiş KMR seyri referansı korunur; tüm hastalardaki KMR anomalileri kırmızı noktalarla overlay gösterilir.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-600">Grafik kontrolleri</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAnomalyControls((prev) => ({ ...prev, kmr: !prev.kmr }))}
                      >
                        {showAnomalyControls.kmr ? "Kontrolleri Gizle" : "Kontrolleri Aç"}
                      </Button>
                    </div>
                    {showAnomalyControls.kmr && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
                        <Button size="sm" variant="outline" onClick={() => openAnomalyFullscreen("kmr")}>Tam Ekran</Button>
                        <Button size="sm" variant="outline" onClick={() => exportAnomalyPlot("kmr", "jpeg")}>JPEG</Button>
                        <Button size="sm" variant="outline" onClick={() => exportAnomalyPlot("kmr", "pdf")}>PDF</Button>
                        <Button size="sm" variant="outline" onClick={() => adjustAnomalyYScale("kmr", 0.2)}>Y+</Button>
                        <Button size="sm" variant="outline" onClick={() => adjustAnomalyYScale("kmr", -0.2)}>Y-</Button>
                        <Button size="sm" variant="outline" onClick={() => resetAnomalyYScale("kmr")}>Y Sıfırla</Button>
                        <Button size="sm" variant="outline" onClick={() => adjustAnomalyXWindow("kmr", -2, kmrXAxisKeys.length)}>X+</Button>
                        <Button size="sm" variant="outline" onClick={() => adjustAnomalyXWindow("kmr", 2, kmrXAxisKeys.length)}>X-</Button>
                        <Button size="sm" variant="outline" onClick={() => resetAnomalyXWindow("kmr", kmrXAxisKeys.length)}>X Tümü</Button>
                        <span className="basis-full text-xs text-slate-600 md:ml-auto md:basis-auto">
                          Y: x{anomalyYScale.kmr.toFixed(1)} | X pencere: {Math.min(anomalyXWindow.kmr, kmrXAxisKeys.length)}/{kmrXAxisKeys.length}
                        </span>
                      </div>
                    )}
                  </div>
                  <div id="anomaly-kmr-container" className="anomaly-plot-container h-96 rounded-md border border-slate-200 bg-white p-2">
                    <Plot
                      divId="anomaly-kmr-plot"
                      data={[
                        ...(hasTrajectory
                          ? [
                              {
                                x: [...cohortTrajectory!.trajectory.map((t) => t.time_key), ...cohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                                y: [...cohortTrajectory!.trajectory.map((t) => t.bound_upper), ...cohortTrajectory!.trajectory.slice().reverse().map((t) => t.bound_lower)],
                                fill: 'toself',
                                fillcolor: 'rgba(59, 130, 246, 0.15)',
                                line: { color: 'transparent' },
                                name: 'P10-P90 Aralığı',
                                showlegend: true,
                                hoverinfo: 'skip',
                                type: 'scatter' as const,
                              },
                              {
                                x: [...cohortTrajectory!.trajectory.map((t) => t.time_key), ...cohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                                y: [...cohortTrajectory!.trajectory.map((t) => t.iqr_upper), ...cohortTrajectory!.trajectory.slice().reverse().map((t) => t.iqr_lower)],
                                fill: 'toself',
                                fillcolor: 'rgba(34, 197, 94, 0.2)',
                                line: { color: 'transparent' },
                                name: 'IQR (P25-P75)',
                                showlegend: true,
                                hoverinfo: 'skip',
                                type: 'scatter' as const,
                              },
                              {
                                x: cohortTrajectory!.trajectory.map((t) => t.time_key),
                                y: cohortTrajectory!.trajectory.map((t) => t.expected_kmr),
                                mode: 'lines+markers',
                                name: 'AI Tahmini (LSTM)',
                                line: { color: '#3b82f6', width: 3 },
                                marker: { size: 8 },
                                type: 'scatter' as const,
                              },
                              {
                                x: cohortTrajectory!.trajectory.map((t) => t.time_key),
                                y: cohortTrajectory!.trajectory.map((t) => t.cohort_median),
                                mode: 'lines+markers',
                                name: 'Gerçek Hasta Medyan',
                                line: { color: '#22c55e', width: 2, dash: 'dash' },
                                marker: { size: 6 },
                                type: 'scatter' as const,
                              },
                            ]
                          : []),
                        {
                          x: kmrAllPoints.map((p) => p.time_key),
                          y: kmrAllPoints.map((p) => p.value),
                          mode: 'markers',
                          name: 'Tüm KMR Ölçümleri',
                          marker: { color: 'rgba(100,116,139,0.35)', size: 6 },
                          type: 'scatter',
                          hovertemplate: '<b>Hasta %{text}</b><br>%{x}<br>KMR: %{y:.4f}<extra></extra>',
                          text: kmrAllPoints.map((p) => p.patient_code),
                        },
                        {
                          x: kmrAnomalyPoints.map((p) => p.time_key),
                          y: kmrAnomalyPoints.map((p) => p.value),
                          mode: 'markers',
                          name: 'KMR Anomali',
                          marker: { color: '#ef4444', size: 9, symbol: 'circle' },
                          type: 'scatter',
                          hovertemplate: '<b>Hasta %{text}</b><br>%{x}<br>Anomali KMR: %{y:.4f}<extra></extra>',
                          text: kmrAnomalyPoints.map((p) => p.patient_code),
                        },
                      ]}
                      layout={{
                        xaxis: {
                          title: 'Zaman Noktası',
                          tickangle: -45,
                          ...(kmrXRange ? { range: kmrXRange } : {}),
                        },
                        yaxis: { title: 'KMR (%)', rangemode: 'tozero', range: [0, kmrAnomalyChartMax * (1.18 * anomalyYScale.kmr) + 0.2] },
                        margin: { t: 85, b: 100, l: 60, r: 30 },
                        legend: { orientation: 'h', y: 1.24, yanchor: 'bottom', x: 0, xanchor: 'left' },
                        paper_bgcolor: '#ffffff',
                        plot_bgcolor: '#ffffff',
                        shapes: [
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0.5, y1: 0.5, line: { color: '#f59e0b', width: 1, dash: 'dot' } },
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 2, y1: 2, line: { color: '#ef4444', width: 1, dash: 'dot' } },
                        ],
                        annotations: [
                          { x: 0.02, xref: 'paper', y: 0.5, text: '0.5% dikkat', showarrow: false, font: { size: 10, color: '#f59e0b' } },
                          { x: 0.02, xref: 'paper', y: 2, text: '2% kritik', showarrow: false, font: { size: 10, color: '#ef4444' } },
                        ],
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: false,
                        toImageButtonOptions: {
                          format: "jpeg",
                          filename: "anomaly_kmr",
                          width: 2200,
                          height: 1200,
                          scale: 2,
                        },
                      }}
                      className="w-full h-full"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>🧪 KRE Anomali Seyri</CardTitle>
                    <CardDescription>KRE medyan seyri + anomali noktaları</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-600">Grafik kontrolleri</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAnomalyControls((prev) => ({ ...prev, kre: !prev.kre }))}
                        >
                          {showAnomalyControls.kre ? "Kontrolleri Gizle" : "Kontrolleri Aç"}
                        </Button>
                      </div>
                      {showAnomalyControls.kre && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
                          <Button size="sm" variant="outline" onClick={() => openAnomalyFullscreen("kre")}>Tam Ekran</Button>
                          <Button size="sm" variant="outline" onClick={() => exportAnomalyPlot("kre", "jpeg")}>JPEG</Button>
                          <Button size="sm" variant="outline" onClick={() => exportAnomalyPlot("kre", "pdf")}>PDF</Button>
                          <Button size="sm" variant="outline" onClick={() => adjustAnomalyYScale("kre", 0.2)}>Y+</Button>
                          <Button size="sm" variant="outline" onClick={() => adjustAnomalyYScale("kre", -0.2)}>Y-</Button>
                          <Button size="sm" variant="outline" onClick={() => resetAnomalyYScale("kre")}>Y Sıfırla</Button>
                        <Button size="sm" variant="outline" onClick={() => adjustAnomalyXWindow("kre", -2, kreXAxisKeys.length)}>X+</Button>
                        <Button size="sm" variant="outline" onClick={() => adjustAnomalyXWindow("kre", 2, kreXAxisKeys.length)}>X-</Button>
                        <Button size="sm" variant="outline" onClick={() => resetAnomalyXWindow("kre", kreXAxisKeys.length)}>X Tümü</Button>
                          <span className="basis-full text-xs text-slate-600 md:ml-auto md:basis-auto">
                            Y: x{anomalyYScale.kre.toFixed(1)} | X pencere: {Math.min(anomalyXWindow.kre, kreXAxisKeys.length)}/{kreXAxisKeys.length}
                          </span>
                        </div>
                      )}
                    </div>
                    <div id="anomaly-kre-container" className="anomaly-plot-container h-80 rounded-md border border-slate-200 bg-white p-2">
                      <Plot
                        divId="anomaly-kre-plot"
                        data={[
                          ...(hasLabTrajectory
                            ? [
                                {
                                  x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                                  y: [...labCohortTrajectory!.trajectory.map((t) => t.bound_kre_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.bound_kre_lower)],
                                  fill: 'toself',
                                  fillcolor: 'rgba(14, 165, 233, 0.14)',
                                  line: { color: 'transparent' },
                                  name: 'KRE P10-P90',
                                  type: 'scatter' as const,
                                  hoverinfo: 'skip',
                                  showlegend: true,
                                },
                                {
                                  x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                                  y: [...labCohortTrajectory!.trajectory.map((t) => t.iqr_kre_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.iqr_kre_lower)],
                                  fill: 'toself',
                                  fillcolor: 'rgba(2, 132, 199, 0.20)',
                                  line: { color: 'transparent' },
                                  name: 'KRE IQR',
                                  type: 'scatter' as const,
                                  hoverinfo: 'skip',
                                  showlegend: true,
                                },
                                {
                                  x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                                  y: labCohortTrajectory!.trajectory.map((t) => t.expected_kre),
                                  mode: 'lines+markers',
                                  name: 'KRE AI Tahmini',
                                  line: { color: '#0284c7', width: 3 },
                                  marker: { size: 6 },
                                  type: 'scatter' as const,
                                },
                                {
                                  x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                                  y: labCohortTrajectory!.trajectory.map((t) => t.cohort_kre_median),
                                  mode: 'lines+markers',
                                  name: 'KRE Cohort Medyan',
                                  line: { color: '#075985', width: 2, dash: 'dash' },
                                  marker: { size: 5 },
                                  type: 'scatter' as const,
                                },
                              ]
                            : []),
                          {
                            x: kreAllPoints.map((p) => p.time_key),
                            y: kreAllPoints.map((p) => p.value),
                            mode: 'markers',
                            name: 'Tüm KRE Ölçümleri',
                            marker: { color: 'rgba(100,116,139,0.35)', size: 6 },
                            type: 'scatter',
                            text: kreAllPoints.map((p) => p.patient_code),
                            hovertemplate: '<b>Hasta %{text}</b><br>%{x}<br>KRE: %{y:.3f}<extra></extra>',
                          },
                          {
                            x: kreAnomalyPoints.map((p) => p.time_key),
                            y: kreAnomalyPoints.map((p) => p.value),
                            mode: 'markers',
                            name: 'KRE Anomali',
                            marker: { color: '#ef4444', size: 9 },
                            type: 'scatter',
                            text: kreAnomalyPoints.map((p) => p.patient_code),
                            hovertemplate: '<b>Hasta %{text}</b><br>%{x}<br>Anomali KRE: %{y:.3f}<extra></extra>',
                          },
                        ]}
                      layout={{
                        xaxis: {
                          title: 'Zaman Noktası',
                          tickangle: -35,
                          ...(kreXRange ? { range: kreXRange } : {}),
                        },
                        yaxis: { title: 'KRE', rangemode: 'tozero', range: [0, kreAnomalyChartMax * (1.18 * anomalyYScale.kre) + 0.2] },
                        margin: { t: 85, b: 80, l: 55, r: 20 },
                        legend: { orientation: 'h', y: 1.24, yanchor: 'bottom', x: 0, xanchor: 'left' },
                        paper_bgcolor: '#ffffff',
                        plot_bgcolor: '#ffffff',
                        shapes: [
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.kre?.very_good_lt ?? 1.2, y1: systemConfig?.clinical_thresholds?.kre?.very_good_lt ?? 1.2, line: { color: '#22c55e', width: 1, dash: 'dot' } },
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.kre?.very_bad_gt ?? 4.5, y1: systemConfig?.clinical_thresholds?.kre?.very_bad_gt ?? 4.5, line: { color: '#ef4444', width: 1, dash: 'dot' } },
                        ],
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: false,
                        toImageButtonOptions: {
                          format: "jpeg",
                          filename: "anomaly_kre",
                          width: 2200,
                          height: 1200,
                          scale: 2,
                        },
                      }}
                      className="w-full h-full"
                    />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>🧪 GFR Anomali Seyri</CardTitle>
                    <CardDescription>GFR medyan seyri + anomali noktaları</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-600">Grafik kontrolleri</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAnomalyControls((prev) => ({ ...prev, gfr: !prev.gfr }))}
                        >
                          {showAnomalyControls.gfr ? "Kontrolleri Gizle" : "Kontrolleri Aç"}
                        </Button>
                      </div>
                      {showAnomalyControls.gfr && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
                          <Button size="sm" variant="outline" onClick={() => openAnomalyFullscreen("gfr")}>Tam Ekran</Button>
                          <Button size="sm" variant="outline" onClick={() => exportAnomalyPlot("gfr", "jpeg")}>JPEG</Button>
                          <Button size="sm" variant="outline" onClick={() => exportAnomalyPlot("gfr", "pdf")}>PDF</Button>
                          <Button size="sm" variant="outline" onClick={() => adjustAnomalyYScale("gfr", 0.2)}>Y+</Button>
                          <Button size="sm" variant="outline" onClick={() => adjustAnomalyYScale("gfr", -0.2)}>Y-</Button>
                          <Button size="sm" variant="outline" onClick={() => resetAnomalyYScale("gfr")}>Y Sıfırla</Button>
                          <Button size="sm" variant="outline" onClick={() => adjustAnomalyXWindow("gfr", -2, gfrXAxisKeys.length)}>X+</Button>
                          <Button size="sm" variant="outline" onClick={() => adjustAnomalyXWindow("gfr", 2, gfrXAxisKeys.length)}>X-</Button>
                          <Button size="sm" variant="outline" onClick={() => resetAnomalyXWindow("gfr", gfrXAxisKeys.length)}>X Tümü</Button>
                          <span className="basis-full text-xs text-slate-600 md:ml-auto md:basis-auto">
                            Y: x{anomalyYScale.gfr.toFixed(1)} | X pencere: {Math.min(anomalyXWindow.gfr, gfrXAxisKeys.length)}/{gfrXAxisKeys.length}
                          </span>
                        </div>
                      )}
                    </div>
                    <div id="anomaly-gfr-container" className="anomaly-plot-container h-80 rounded-md border border-slate-200 bg-white p-2">
                      <Plot
                        divId="anomaly-gfr-plot"
                        data={[
                          ...(hasLabTrajectory
                            ? [
                                {
                                  x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                                  y: [...labCohortTrajectory!.trajectory.map((t) => t.bound_gfr_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.bound_gfr_lower)],
                                  fill: 'toself',
                                  fillcolor: 'rgba(6, 182, 212, 0.14)',
                                  line: { color: 'transparent' },
                                  name: 'GFR P10-P90',
                                  type: 'scatter' as const,
                                  hoverinfo: 'skip',
                                  showlegend: true,
                                },
                                {
                                  x: [...labCohortTrajectory!.trajectory.map((t) => t.time_key), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.time_key)],
                                  y: [...labCohortTrajectory!.trajectory.map((t) => t.iqr_gfr_upper), ...labCohortTrajectory!.trajectory.slice().reverse().map((t) => t.iqr_gfr_lower)],
                                  fill: 'toself',
                                  fillcolor: 'rgba(8, 145, 178, 0.20)',
                                  line: { color: 'transparent' },
                                  name: 'GFR IQR',
                                  type: 'scatter' as const,
                                  hoverinfo: 'skip',
                                  showlegend: true,
                                },
                                {
                                  x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                                  y: labCohortTrajectory!.trajectory.map((t) => t.expected_gfr),
                                  mode: 'lines+markers',
                                  name: 'GFR AI Tahmini',
                                  line: { color: '#0891b2', width: 3 },
                                  marker: { size: 6 },
                                  type: 'scatter' as const,
                                },
                                {
                                  x: labCohortTrajectory!.trajectory.map((t) => t.time_key),
                                  y: labCohortTrajectory!.trajectory.map((t) => t.cohort_gfr_median),
                                  mode: 'lines+markers',
                                  name: 'GFR Cohort Medyan',
                                  line: { color: '#155e75', width: 2, dash: 'dash' },
                                  marker: { size: 5 },
                                  type: 'scatter' as const,
                                },
                              ]
                            : []),
                          {
                            x: gfrAllPoints.map((p) => p.time_key),
                            y: gfrAllPoints.map((p) => p.value),
                            mode: 'markers',
                            name: 'Tüm GFR Ölçümleri',
                            marker: { color: 'rgba(100,116,139,0.35)', size: 6 },
                            type: 'scatter',
                            text: gfrAllPoints.map((p) => p.patient_code),
                            hovertemplate: '<b>Hasta %{text}</b><br>%{x}<br>GFR: %{y:.2f}<extra></extra>',
                          },
                          {
                            x: gfrAnomalyPoints.map((p) => p.time_key),
                            y: gfrAnomalyPoints.map((p) => p.value),
                            mode: 'markers',
                            name: 'GFR Anomali',
                            marker: { color: '#ef4444', size: 9 },
                            type: 'scatter',
                            text: gfrAnomalyPoints.map((p) => p.patient_code),
                            hovertemplate: '<b>Hasta %{text}</b><br>%{x}<br>Anomali GFR: %{y:.2f}<extra></extra>',
                          },
                        ]}
                      layout={{
                        xaxis: {
                          title: 'Zaman Noktası',
                          tickangle: -35,
                          ...(gfrXRange ? { range: gfrXRange } : {}),
                        },
                        yaxis: { title: 'GFR', rangemode: 'tozero', range: [0, gfrAnomalyChartMax * (1.18 * anomalyYScale.gfr) + 5] },
                        margin: { t: 85, b: 80, l: 55, r: 20 },
                        legend: { orientation: 'h', y: 1.24, yanchor: 'bottom', x: 0, xanchor: 'left' },
                        paper_bgcolor: '#ffffff',
                        plot_bgcolor: '#ffffff',
                        shapes: [
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.gfr?.very_good_ge ?? 90, y1: systemConfig?.clinical_thresholds?.gfr?.very_good_ge ?? 90, line: { color: '#22c55e', width: 1, dash: 'dot' } },
                          { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: systemConfig?.clinical_thresholds?.gfr?.very_bad_le ?? 15, y1: systemConfig?.clinical_thresholds?.gfr?.very_bad_le ?? 15, line: { color: '#ef4444', width: 1, dash: 'dot' } },
                        ],
                      }}
                      config={{
                        responsive: true,
                        displayModeBar: false,
                        toImageButtonOptions: {
                          format: "jpeg",
                          filename: "anomaly_gfr",
                          width: 2200,
                          height: 1200,
                          scale: 2,
                        },
                      }}
                      className="w-full h-full"
                    />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Anomali seyri verisi bulunamadı. Pipeline sonrası otomatik oluşur.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
