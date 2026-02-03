"use client";

import React, { useState, useMemo, useRef, useReducer } from "react";
import { useParams } from "next/navigation";
import { usePatientDetail, useReferenceBand, useCohortTrajectory, useLABCohortTrajectory, RISK_COLORS } from "@/hooks/useKimerizmData";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { RiskLevel, TimelinePoint } from "@/types";
import { formatGender, formatVitalStatus } from "@/utils/formatters";

// Unified time mapping - LAB_TIME_MAP → UNIFIED_TIME_MAP conversion
// Backend time_mapping.py'ye göre: Month_11=21, Month_12=22
const LAB_TO_UNIFIED_MAP: Record<string, number> = {
  "Day_7": 7,
  "Week_2": 8,
  "Week_3": 9,
  "Month_1": 11,
  "Month_2": 12,
  "Month_3": 13,
  "Month_4": 14,
  "Month_5": 15,
  "Month_6": 16,
  "Month_12": 22  // Backend time_mapping.py'ye göre Month_12=22
};

// UNIFIED_TIME_MAP - Backend time_mapping.py ile birebir aynı sıra
// Day_1(1)..Day_7(7), Week_2(8), Week_3(9), Week_4(10), Month_1(11), Month_2(12), 
// Month_3(13), Month_4(14), Month_5(15), Month_6(16), Month_7(17), Month_8(18), 
// Month_9(19), Month_10(20), Month_11(21), Month_12(22)
const UNIFIED_TIME_KEYS: Array<{key: string; order: number}> = [
  {key: "Day_1", order: 1}, {key: "Day_2", order: 2}, {key: "Day_3", order: 3},
  {key: "Day_4", order: 4}, {key: "Day_5", order: 5}, {key: "Day_6", order: 6},
  {key: "Day_7", order: 7}, {key: "Week_2", order: 8}, {key: "Week_3", order: 9},
  {key: "Week_4", order: 10}, {key: "Month_1", order: 11}, {key: "Month_2", order: 12},
  {key: "Month_3", order: 13}, {key: "Month_4", order: 14}, {key: "Month_5", order: 15},
  {key: "Month_6", order: 16}, {key: "Month_7", order: 17}, {key: "Month_8", order: 18},
  {key: "Month_9", order: 19}, {key: "Month_10", order: 20}, {key: "Month_11", order: 21},
  {key: "Month_12", order: 22}  // Backend time_mapping.py'ye göre Month_12=22
];

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Renk sabitleri - Toggle ve katman eşleşmesi için
const COLORS = {
  kmr: {
    line: '#2563eb', // KMR gerçek çizgi
    referenceMedian: '#f59e0b', // Referans median
    referenceIQR: 'rgba(245, 158, 11, 0.08)', // Referans IQR
    aiLine: '#10b981', // AI çizgi
    aiBand: 'rgba(16, 185, 129, 0.06)', // AI band
    cohort: '#22c55e', // Benzer Hastalar
    forecastShadow: 'rgba(16, 185, 129, 0.05)' // Forecast gölgesi
  },
  kre: {
    line: '#8b5cf6', // KRE gerçek çizgi
    referenceMedian: '#c084fc', // Referans median
    referenceIQR: 'rgba(192, 132, 252, 0.08)', // Referans IQR
    aiLine: '#7c3aed', // AI çizgi
    aiBand: 'rgba(124, 58, 237, 0.06)', // AI band
    cohort: '#a855f7', // Benzer Hastalar
    forecastShadow: 'rgba(124, 58, 237, 0.05)' // Forecast gölgesi
  },
  gfr: {
    line: '#06b6d4', // GFR gerçek çizgi
    referenceMedian: '#38bdf8', // Referans median
    referenceIQR: 'rgba(6, 182, 212, 0.08)', // Referans IQR
    aiLine: '#0ea5e9', // AI çizgi
    aiBand: 'rgba(14, 165, 233, 0.06)', // AI band
    cohort: '#22d3ee', // Benzer Hastalar
    forecastShadow: 'rgba(14, 165, 233, 0.05)' // Forecast gölgesi
  },
  thresholds: {
    critical: '#ef4444', // Kritik eşik (diamond)
    moderate: '#f59e0b' // Orta eşik (circle)
  }
};


export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;
  
  const { data: patient, isLoading, error } = usePatientDetail(patientId);
  const { data: referenceBand } = useReferenceBand();
  const { data: cohortTrajectory } = useCohortTrajectory();
  const { data: labCohortTrajectory } = useLABCohortTrajectory();
  
  // GFR cohort kontrolü - JSX'te kullanılmak üzere (erken return'den önce)
  const hasGfrCohort = useMemo(() => {
    if (!labCohortTrajectory) return false;
    const labCohortGfrMap = new Map(labCohortTrajectory.trajectory.map(t => [t.time_order, t.expected_gfr]));
    return Array.from(labCohortGfrMap.values()).some(v => v !== null && typeof v === 'number');
  }, [labCohortTrajectory]);

  // Panel state yönetimi - useReducer ile performans iyileştirmesi
  type PanelState = { metrics: boolean; stats: boolean; clinical: boolean; thresholds: boolean };
  type PanelAction = { type: 'TOGGLE'; section: keyof PanelState } | { type: 'SET'; section: keyof PanelState; value: boolean };
  const panelReducer = (state: PanelState, action: PanelAction): PanelState => {
    switch (action.type) {
      case 'TOGGLE':
        return { ...state, [action.section]: !state[action.section] };
      case 'SET':
        return { ...state, [action.section]: action.value };
      default:
        return state;
    }
  };
  const [expandedSections, dispatchExpanded] = useReducer(panelReducer, { metrics: false, stats: false, clinical: true, thresholds: false });
  
  // Hover state kaldırıldı - sadece pinned kullanılıyor
  
  // PinnedPoint highlight animasyonu için
  const [pinnedPointHighlight, setPinnedPointHighlight] = useState(false);

  // Chart display options - Her grafik için ayrı kontroller (grafik bazlı mikro-toggle'lar)
  // KMR kontrolleri
  const [kmrShowReference, setKmrShowReference] = useState(true);
  const [kmrShowAI, setKmrShowAI] = useState(true);
  const [kmrShowCohort, setKmrShowCohort] = useState(true);
  const [kmrShowBand, setKmrShowBand] = useState(true);
  const [kmrShowEşikler, setKmrShowEşikler] = useState(true);
  const kmrShowReferenceIQR = kmrShowReference;
  const kmrShowReferenceMedian = kmrShowReference;
  const kmrShowAIPrediction = kmrShowAI;
  const kmrShowAIBand = kmrShowBand;
  
  // KRE kontrolleri
  const [kreShowReference, setKreShowReference] = useState(true);
  const [kreShowAI, setKreShowAI] = useState(true);
  const [kreShowCohort, setKreShowCohort] = useState(true);
  const [kreShowBand, setKreShowBand] = useState(true);
  const [kreShowEşikler, setKreShowEşikler] = useState(true);
  const kreShowReferenceIQR = kreShowReference;
  const kreShowReferenceMedian = kreShowReference;
  const kreShowAIPrediction = kreShowAI;
  const kreShowAIBand = kreShowBand;
  
  // GFR kontrolleri
  const [gfrShowReference, setGfrShowReference] = useState(true);
  const [gfrShowAI, setGfrShowAI] = useState(true);
  const [gfrShowCohort, setGfrShowCohort] = useState(true);
  const [gfrShowBand, setGfrShowBand] = useState(true);
  const [gfrShowEşikler, setGfrShowEşikler] = useState(true);
  const gfrShowReferenceIQR = gfrShowReference;
  const gfrShowReferenceMedian = gfrShowReference;
  const gfrShowAIPrediction = gfrShowAI;
  const gfrShowAIBand = gfrShowBand;
  
  // Eşik kontrolleri (ortak)
  const [showModerateThresholds, setShowModerateThresholds] = useState(false);
  
  // Klinik öneri sekmesi
  const [clinicalTab, setClinicalTab] = useState<'all' | 'action' | 'watch' | 'info'>('all');
  
  const showKMR = true;
  const showAnomalies = true; // Anomalies always shown (critical)

  // Pinned point state for dynamic analysis panel
  type PinnedPointInfo = {
    timeOrder: number;
    timeKey: string;
    kmr: number | null;
    kre: number | null;
    gfr: number | null;
    risk: number | null;
    riskLevel: string | null;
    kmrPred: number | null;
    krePred: number | null;
    gfrPred: number | null;
    kreAnomalyScore: number | null;
    gfrAnomalyScore: number | null;
    kreAnomalyFlag: boolean;
    gfrAnomalyFlag: boolean;
    isAnomaly: boolean;
  } | null;
  const [pinnedPoint, setPinnedPoint] = useState<PinnedPointInfo>(null);

  // Ref for plot click handling
  const plotRef = useRef<HTMLDivElement>(null);

  // Computed statistics - pinned order'a kadar hesapla
  const stats = useMemo(() => {
    if (!patient?.timeline || patient.timeline.length === 0) return null;
    
    // PinnedPoint varsa pinned order'a kadar filtrele, yoksa tüm timeline
    const filteredTimeline = pinnedPoint 
      ? patient.timeline.filter((t: TimelinePoint) => t.time_order <= pinnedPoint.timeOrder)
      : patient.timeline;
    
    const kmrValues = filteredTimeline.map((t: TimelinePoint) => t.kmr).filter((v: number | null) => v !== null) as number[];
    const riskValues = filteredTimeline.map((t: TimelinePoint) => t.risk_score).filter((v: number | null) => v !== null) as number[];
    
    // Trend calculation
    let kmrTrend = 0;
    if (kmrValues.length >= 2) {
      const n = kmrValues.length;
      const xMean = (n - 1) / 2;
      const yMean = kmrValues.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      kmrValues.forEach((y, i) => {
        num += (i - xMean) * (y - yMean);
        den += (i - xMean) ** 2;
      });
      kmrTrend = den !== 0 ? num / den : 0;
    }

    // Anomaly count
    const anomalyCount = filteredTimeline.filter((t: TimelinePoint) => t.kmr_anomaly_flag).length;

    // Volatility (CV)
    const mean = kmrValues.reduce((a, b) => a + b, 0) / kmrValues.length;
    const std = Math.sqrt(kmrValues.reduce((a, b) => a + (b - mean) ** 2, 0) / kmrValues.length);
    const cv = mean > 0 ? std / mean : 0;

    const kreValues = filteredTimeline.map((t: TimelinePoint) => t.kre).filter((v: number | null) => v !== null) as number[];
    const gfrValues = filteredTimeline.map((t: TimelinePoint) => t.gfr).filter((v: number | null) => v !== null) as number[];

    return {
      kmrMin: Math.min(...kmrValues),
      kmrMax: Math.max(...kmrValues),
      kmrMean: mean,
      kmrStd: std,
      kmrCV: cv,
      kmrTrend,
      riskMean: riskValues.length > 0 ? riskValues.reduce((a, b) => a + b, 0) / riskValues.length : 0,
      anomalyCount,
      totalPoints: kmrValues.length,
      kreCount: kreValues.length,
      gfrCount: gfrValues.length,
      kreLast: kreValues.length > 0 ? kreValues[kreValues.length - 1] : null,
      gfrLast: gfrValues.length > 0 ? gfrValues[gfrValues.length - 1] : null
    };
  }, [patient, pinnedPoint]);

  // Clinical recommendations - filtrelenmiş (pinnedPoint varsa pinnedPoint değerlerini kullan)
  const filteredRecommendations = useMemo(() => {
    if (!patient || !stats) return [];
    const recs: { type: 'success' | 'warning' | 'danger' | 'info'; text: string }[] = [];
    
    // PinnedPoint varsa pinnedPoint değerlerini kullan, yoksa last_status
    const currentKMR = pinnedPoint?.kmr ?? patient.last_status.kmr_last;
    const currentKRE = pinnedPoint?.kre ?? stats.kreLast;
    const currentGFR = pinnedPoint?.gfr ?? stats.gfrLast;
    const currentRisk = pinnedPoint?.riskLevel ?? patient.last_status.risk_level_last;
    
    // KMR eşikleri
    if (currentKMR !== null && currentKMR !== undefined) {
      if (currentKMR < 0.5) {
        recs.push({ type: 'success', text: `KMR değeri normal aralıkta (${currentKMR.toFixed(3)}%)` });
      } else if (currentKMR < 2) {
        recs.push({ type: 'warning', text: `KMR değeri dikkat gerektiriyor (${currentKMR.toFixed(3)}%)` });
      } else if (currentKMR < 5) {
        recs.push({ type: 'danger', text: `KMR değeri kritik seviyede (${currentKMR.toFixed(3)}%)` });
      } else {
        recs.push({ type: 'danger', text: `KMR değeri çok kritik! (${currentKMR.toFixed(3)}%)` });
      }
    }

    // KRE eşikleri
    if (currentKRE !== null && currentKRE !== undefined) {
      if (currentKRE > 4.5 || currentKRE < 0) {
        recs.push({ type: 'danger', text: `Kreatinin kritik derecede yüksek (${currentKRE.toFixed(2)})` });
      } else if (currentKRE > 2.0) {
        recs.push({ type: 'warning', text: `Kreatinin yüksek (${currentKRE.toFixed(2)})` });
      } else if (currentKRE < 1.2) {
        recs.push({ type: 'success', text: `Kreatinin normal aralıkta (${currentKRE.toFixed(2)})` });
      }
    }

    // GFR eşikleri
    if (currentGFR !== null && currentGFR !== undefined) {
      if (currentGFR < 15) {
        recs.push({ type: 'danger', text: `GFR kritik derecede düşük - böbrek yetmezliği (${currentGFR.toFixed(0)})` });
      } else if (currentGFR < 30) {
        recs.push({ type: 'danger', text: `GFR çok düşük (${currentGFR.toFixed(0)})` });
      } else if (currentGFR < 60) {
        recs.push({ type: 'warning', text: `GFR düşük (${currentGFR.toFixed(0)})` });
      } else if (currentGFR >= 90) {
        recs.push({ type: 'success', text: `GFR normal aralıkta (${currentGFR.toFixed(0)})` });
      }
    }

    // Trend analizi (sadece pinnedPoint yoksa)
    if (!pinnedPoint) {
      if (stats.kmrTrend < -0.05) {
        recs.push({ type: 'success', text: 'KMR trendi düşüş gösteriyor (iyileşme)' });
      } else if (stats.kmrTrend > 0.05) {
        recs.push({ type: 'danger', text: 'KMR trendi artış gösteriyor (dikkat!)' });
      }

      if (stats.anomalyCount > 0) {
        recs.push({ type: 'warning', text: `${stats.anomalyCount} adet anomali tespit edildi` });
      }
    } else {
      // PinnedPoint için anomali kontrolü
      if (pinnedPoint.isAnomaly || pinnedPoint.kreAnomalyFlag || pinnedPoint.gfrAnomalyFlag) {
        recs.push({ type: 'warning', text: 'Bu noktada anomali tespit edildi' });
      }
    }

    if (currentRisk === 'Çok Kritik') {
      recs.push({ type: 'danger', text: 'Acil müdahale gerekebilir!' });
    }

    if (patient.meta.improved_proxy) {
      recs.push({ type: 'info', text: 'Hasta iyileşmiş Hasta grubunda' });
    }

    // Sekmeye göre filtrele
    if (clinicalTab === 'all') return recs;
    if (clinicalTab === 'action') return recs.filter(r => r.type === 'danger');
    if (clinicalTab === 'watch') return recs.filter(r => r.type === 'warning');
    if (clinicalTab === 'info') return recs.filter(r => r.type === 'info' || r.type === 'success');
    return recs;
  }, [patient, stats, clinicalTab, pinnedPoint]);

  // Build unified timeline grid - tüm time_order'ları içeren sürekli grid
  // Grid limitini max(patient, reference_band.kmr, cohort_trajectory) olacak şekilde genişlet
  // Bu hook erken return'lerden ÖNCE çağrılmalı
  const timelineGrid = useMemo(() => {
    // Hasta timeline max order
    const patientMaxOrder = (patient?.timeline && patient.timeline.length > 0)
      ? Math.max(...patient.timeline.map((t: TimelinePoint) => t.time_order))
      : 0;
    
    // Reference band KMR max order (time_order 1-21, Month_12=21)
    const kmrBandMaxOrder = (referenceBand?.bands?.kmr && referenceBand.bands.kmr.length > 0)
      ? Math.max(...referenceBand.bands.kmr.map((b: {time_order: number}) => b.time_order))
      : 0;
    
    // Cohort trajectory max order
    const cohortMaxOrder = (cohortTrajectory?.trajectory && cohortTrajectory.trajectory.length > 0)
      ? Math.max(...cohortTrajectory.trajectory.map((t: {time_order: number}) => t.time_order))
      : 0;
    
    // Grid max = max of all sources (mevcut verilere göre, sabit 22 zorlaması yok)
    const gridMaxOrder = Math.max(patientMaxOrder, kmrBandMaxOrder, cohortMaxOrder, 1); // En az 1 (Day_1)
    
    // Grid min = 1 (Day_1'den başla)
    const gridMinOrder = 1;
    
    // Hasta timeline map
    const timelineMap = (patient?.timeline && patient.timeline.length > 0)
      ? new Map(patient.timeline.map(t => [t.time_order, t]))
      : new Map();
    
    // Unified time keys map (order -> key)
    const unifiedKeyMap = new Map(UNIFIED_TIME_KEYS.map(item => [item.order, item.key]));
    
    // Build grid from 1 to gridMaxOrder
    const grid: Array<{ timeOrder: number; timeKey: string | null; timelinePoint: TimelinePoint | null }> = [];
    for (let order = gridMinOrder; order <= gridMaxOrder; order++) {
      const point = timelineMap.get(order);
      const unifiedKey = unifiedKeyMap.get(order);
      grid.push({
        timeOrder: order,
        timeKey: point?.time_key || unifiedKey || null,
        timelinePoint: point || null
      });
    }
    return grid;
  }, [patient, referenceBand, cohortTrajectory]);

  // Şerit/şerit zaman vurgusu - alternatif renkli şeritler (her iki subplot için)
  // Bu hook da erken return'lerden ÖNCE çağrılmalı
  const timelineStripes = useMemo(() => {
    if (timelineGrid.length === 0) return [];
    const stripes: Array<{type: string; xref: string; yref: string; x0: number; x1: number; y0: number; y1: number; fillcolor: string; line: {width: number}; layer?: string}> = [];
    for (let i = 0; i < timelineGrid.length - 1; i++) {
      const isEven = i % 2 === 0;
      const hasData = timelineGrid[i].timelinePoint !== null;
      const color = hasData 
        ? (isEven ? 'rgba(148,163,184,0.01)' : 'rgba(148,163,184,0.005)') // Opaklık daha da düşürüldü
        : 'rgba(200,200,200,0.02)'; // Eksik veri için gri şerit (daha açık)
      // Üst subplot (KMR) için şerit - paper referansı kullan
      stripes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: timelineGrid[i].timeOrder - 0.5,
        x1: timelineGrid[i + 1].timeOrder - 0.5,
        y0: 0.56, // Üst subplot domain başlangıcı (domain ile uyumlu)
        y1: 1, // Üst subplot domain sonu
        fillcolor: color,
        line: { width: 0 },
        layer: 'below'
      });
      // Alt subplot (KRE/GFR) için şerit - paper referansı kullan
      stripes.push({
        type: 'rect',
        xref: 'x2',
        yref: 'paper',
        x0: timelineGrid[i].timeOrder - 0.5,
        x1: timelineGrid[i + 1].timeOrder - 0.5,
        y0: 0, // Alt subplot domain başlangıcı
        y1: 0.48, // Alt subplot domain sonu (domain ile uyumlu)
        fillcolor: color,
        line: { width: 0 },
        layer: 'below'
      });
    }
    return stripes;
  }, [timelineGrid]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-lg font-medium">Hasta verisi yüklenemedi</p>
          <p className="text-sm text-muted-foreground">{patientId}</p>
          <Link href="/patients"><Button className="mt-4" variant="outline">← Geri</Button></Link>
        </div>
      </div>
    );
  }

  if (isLoading || !patient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Veri kontrolü - timeline boşsa uyarı göster
  if (!patient.timeline || patient.timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="text-center">
          <div className="text-yellow-500 text-xl mb-2">⚠️</div>
          <p className="text-lg font-medium">Bu hasta için veri bulunamadı</p>
          <p className="text-sm text-muted-foreground">Timeline boş veya yüklenemedi</p>
          <Link href="/patients"><Button className="mt-4" variant="outline">← Hasta Listesine Dön</Button></Link>
        </div>
      </div>
    );
  }

  const { meta, timeline, last_status } = patient;
  const rawKmrBands = referenceBand?.bands?.kmr || [];
  const rawKreBands = referenceBand?.bands?.kre || [];
  const rawGfrBands = referenceBand?.bands?.gfr || [];
  
  // Son gerçek noktaların time_order'ları (forecast geçiş noktaları)
  const lastKmrOrder = last_status?.last_kmr_order ?? null;
  const lastKreOrder = last_status?.last_kre_order ?? null;
  const lastGfrOrder = last_status?.last_gfr_order ?? null;
  
  // Timeline grid zaten yukarıda oluşturuldu, min/max order'ları al
  const minTimeOrder = timelineGrid.length > 0 ? timelineGrid[0].timeOrder : 1;
  const maxTimeOrder = timelineGrid.length > 0 ? timelineGrid[timelineGrid.length - 1].timeOrder : 0;
  
  // KMR band'ları timeline grid'e göre map et
  // Reference band'da time_order'lar backend'den 1 eksik olabilir (Month_11=20, Month_12=21)
  // Backend time_mapping.py'ye göre: Month_11=21, Month_12=22
  // time_key'ye göre doğru order'a map et
  const mapKmrBandsToGrid = (bands: Array<{time_key?: string; time_order: number; median: number; p25: number; p75: number}>) => {
    if (bands.length === 0) return [];
    const bandMap = new Map<number, {time_order: number; median: number; p25: number; p75: number}>();
    bands.forEach(b => {
      // time_key'ye göre doğru unified order'ı bul
      let order = b.time_order;
      if (b.time_key) {
        const unifiedKey = UNIFIED_TIME_KEYS.find(k => k.key === b.time_key);
        if (unifiedKey) {
          order = unifiedKey.order; // Backend time_mapping.py'ye göre doğru order
        }
      }
      // Eğer aynı order'da birden fazla band varsa, sonuncusunu kullan
      bandMap.set(order, { time_order: order, median: b.median, p25: b.p25, p75: b.p75 });
    });
    const mapped = timelineGrid.map(gridItem => {
      const band = bandMap.get(gridItem.timeOrder);
      return band || null;
    }).filter(b => b !== null) as Array<{time_order: number; median: number; p25: number; p75: number}>;
    // time_order'a göre sırala (artan ve tekil olmasını garantile)
    return mapped.sort((a, b) => a.time_order - b.time_order);
  };
  
  // KRE/GFR band'larını LAB_TIME_MAP → UNIFIED_TIME_MAP ile map et
  const mapLabBandsToGrid = (bands: Array<{time_key: string; time_order: number; median: number; p25: number; p75: number}>) => {
    if (bands.length === 0) return [];
    // LAB time_key'den base key'i çıkar (örn: "Day_7_KRE" → "Day_7")
    const labBandMap = new Map<string, {time_order: number; median: number; p25: number; p75: number}>();
    bands.forEach(b => {
      const baseKey = b.time_key.replace('_KRE', '').replace('_GFR', '');
      const unifiedOrder = LAB_TO_UNIFIED_MAP[baseKey];
      if (unifiedOrder) {
        labBandMap.set(baseKey, { time_order: unifiedOrder, median: b.median, p25: b.p25, p75: b.p75 });
      }
    });
    
    // Grid'e göre map et ve time_order'a göre sırala (artan ve tekil olmasını garantile)
    const mapped = timelineGrid.map(gridItem => {
      const gridKey = gridItem.timeKey;
      if (!gridKey) return null;
      const baseKey = gridKey.replace('_KRE', '').replace('_GFR', '');
      const band = labBandMap.get(baseKey);
      if (band && band.time_order === gridItem.timeOrder) {
        return band;
      }
      return null;
    }).filter(b => b !== null) as Array<{time_order: number; median: number; p25: number; p75: number}>;
    
    // time_order'a göre sırala (artan ve tekil olmasını garantile)
    return mapped.sort((a, b) => a.time_order - b.time_order);
  };
  
  const kmrBands = mapKmrBandsToGrid(rawKmrBands);
  // KRE/GFR bandları aşağıda map edilecek

  // Build unified plot data for subplots
  // Subplot 1 (KMR): xaxis='x', yaxis='y'
  // Subplot 2 (KRE/GFR): xaxis='x2', yaxis='y3' (KRE), yaxis2='y4' (GFR)
  const kmrPlotData: Record<string, unknown>[] = [];
  const kreGfrPlotData: Record<string, unknown>[] = [];
  const allShapes: Record<string, unknown>[] = [];

  // KMR Subplot Data (xaxis='x', yaxis='y')
  // Reference band IQR
  if (kmrShowReferenceIQR && kmrBands.length > 0) {
    kmrPlotData.push({
      x: [...kmrBands.map(b => b.time_order), ...kmrBands.slice().reverse().map(b => b.time_order)],
      y: [...kmrBands.map(b => b.p75), ...kmrBands.slice().reverse().map(b => b.p25)],
      fill: 'toself', fillcolor: COLORS.kmr.referenceIQR, line: { color: 'transparent' },
      name: 'Referans IQR', hoverinfo: 'skip', type: 'scatter', xaxis: 'x', yaxis: 'y',
      showlegend: false
    });
  }

  // Reference median
  if (kmrShowReferenceMedian && kmrBands.length > 0) {
    kmrPlotData.push({
      x: kmrBands.map(b => b.time_order), y: kmrBands.map(b => b.median),
      type: 'scatter', mode: 'lines', name: 'Referans Median',
      line: { color: COLORS.kmr.referenceMedian, width: 2, dash: 'dot' }, xaxis: 'x', yaxis: 'y',
      showlegend: false
    });
  }

  // Cohort trajectory - grid'e map et, eksik ön kısımları null bırak
  // KMR Benzer Hastalar (cohort trajectory) - improved cohort'tan beklenen seyir
  if (kmrShowCohort && cohortTrajectory) {
    const cohortMap = new Map(cohortTrajectory.trajectory.map(t => [t.time_order, t.expected_kmr]));
    kmrPlotData.push({
      x: timelineGrid.map(g => g.timeOrder),
      y: timelineGrid.map(g => cohortMap.get(g.timeOrder) ?? null),
      type: 'scatter', mode: 'lines', name: 'Benzer Hastalar',
      line: { color: COLORS.kmr.cohort, width: 1.5, dash: 'dot' },
      connectgaps: true, xaxis: 'x', yaxis: 'y',
      legendgroup: 'benzer_hastalar',
      legendgrouptitle: { text: 'Benzer Hastalar' },
      showlegend: false
    });
  }

  // KMR AI Tahmini - geçmiş ve gelecek olarak iki parça
  if (kmrShowAIPrediction && showKMR) {
    const aiPredData = timelineGrid.map(g => {
      if (g.timeOrder >= 1) {
        return g.timelinePoint?.kmr_pred ?? null;
      }
      return null;
    });
    
    const aiPredLoData = timelineGrid.map(g => {
      if (g.timeOrder >= 1) {
        return g.timelinePoint?.kmr_pred_lo ?? null;
      }
      return null;
    });
    
    const aiPredHiData = timelineGrid.map(g => {
      if (g.timeOrder >= 1) {
        return g.timelinePoint?.kmr_pred_hi ?? null;
      }
      return null;
    });
    
    // Son gerçek KMR noktasını bul (lastKmrOrder veya timeline'dan)
    const actualLastKmrOrder = lastKmrOrder ?? (timeline.findLast((t: TimelinePoint) => t.kmr !== null)?.time_order ?? null);
    
    // Geçmiş tahminler (son gerçek noktaya kadar)
    const pastPredData = timelineGrid.map((g, idx) => {
      if (g.timeOrder >= 1 && actualLastKmrOrder !== null && g.timeOrder <= actualLastKmrOrder) {
        return aiPredData[idx];
      }
      return null;
    });
    
    // Gelecek tahminler (son gerçek noktadan sonra)
    const futurePredData = timelineGrid.map((g, idx) => {
      if (g.timeOrder >= 1 && actualLastKmrOrder !== null && g.timeOrder > actualLastKmrOrder) {
        return aiPredData[idx];
      }
      return null;
    });
    
    // Geçmiş AI tahmini çizgisi
    if (pastPredData.some(v => v !== null)) {
      kmrPlotData.push({
        x: timelineGrid.map(g => g.timeOrder),
        y: pastPredData,
        type: 'scatter', mode: 'lines', name: 'AI Tahmini',
        line: { color: COLORS.kmr.aiLine, width: 2.5, dash: 'dashdot' },
        connectgaps: false, xaxis: 'x', yaxis: 'y',
        legendgroup: 'ai_kmr',
        showlegend: false,
        hovertemplate: '<b>AI Tahmini (geçmiş)</b><br>%{x}<br>%{y:.4f}%<extra></extra>'
      });
    }
    
    // Gelecek AI tahmini çizgisi (forecast)
    if (futurePredData.some(v => v !== null) && actualLastKmrOrder !== null) {
      kmrPlotData.push({
        x: timelineGrid.map(g => g.timeOrder),
        y: futurePredData,
        type: 'scatter', mode: 'lines', name: 'AI Tahmini',
        line: { color: COLORS.kmr.aiLine, width: 2.5, dash: 'longdash', opacity: 0.7 },
        connectgaps: false, xaxis: 'x', yaxis: 'y',
        legendgroup: 'ai_kmr',
        showlegend: false, // Geçmiş ile aynı grup, tek legend satırı
        hovertemplate: '<b>AI Tahmini (gelecek)</b><br>%{x}<br>%{y:.4f}%<extra></extra>'
      });
      
      // Forecast bölgesi gölgesi (son gerçek noktadan sonra)
      allShapes.push({
        type: 'rect',
        x0: actualLastKmrOrder + 0.5,
        x1: maxTimeOrder + 0.5,
        y0: 0,
        y1: 1,
        fillcolor: COLORS.kmr.forecastShadow,
        line: { width: 0 },
        xref: 'x',
        yref: 'paper',
        layer: 'below'
      });
    }
    
    // AI Tahmin Bandı (lo/hi) - geçmiş ve gelecek için ayrı bandlar
    // Güçlendirilmiş kontrol: hem hi hem lo dizilerinde yeterli sayıda null olmayan değer olmalı
    const aiLoValid = aiPredLoData.filter(v => v !== null && typeof v === 'number' && !isNaN(v));
    const aiHiValid = aiPredHiData.filter(v => v !== null && typeof v === 'number' && !isNaN(v));
    const hasValidAiBand = aiLoValid.length >= 2 && aiHiValid.length >= 2;
    
    if (kmrShowAIBand && hasValidAiBand && actualLastKmrOrder !== null) {
      // Geçmiş band (son gerçek noktaya kadar)
      const pastBandX = timelineGrid
        .filter((g, idx) => g.timeOrder <= actualLastKmrOrder && aiPredLoData[idx] !== null && aiPredHiData[idx] !== null)
        .map(g => g.timeOrder);
      const pastBandY = pastBandX.map(order => {
        const idx = timelineGrid.findIndex(g => g.timeOrder === order);
        return aiPredHiData[idx];
      }).concat(pastBandX.slice().reverse().map(order => {
        const idx = timelineGrid.findIndex(g => g.timeOrder === order);
        return aiPredLoData[idx];
      }));
      const pastBandXClosed = [...pastBandX, ...pastBandX.slice().reverse()];
      
      if (pastBandX.length >= 2) {
        kmrPlotData.push({
          x: pastBandXClosed,
          y: pastBandY,
          fill: 'toself',
          fillcolor: COLORS.kmr.aiBand,
          line: { color: 'transparent' },
          name: 'KMR AI Tahmin Bandı (geçmiş)',
          hoverinfo: 'skip',
          type: 'scatter' as const,
          xaxis: 'x',
          yaxis: 'y',
          legendgroup: 'ai_tahmini',
          showlegend: false,
          connectgaps: false
        });
      }
      
      // Gelecek band (son gerçek noktadan sonra)
      const futureBandX = timelineGrid
        .filter((g, idx) => g.timeOrder > actualLastKmrOrder && aiPredLoData[idx] !== null && aiPredHiData[idx] !== null)
        .map(g => g.timeOrder);
      const futureBandY = futureBandX.map(order => {
        const idx = timelineGrid.findIndex(g => g.timeOrder === order);
        return aiPredHiData[idx];
      }).concat(futureBandX.slice().reverse().map(order => {
        const idx = timelineGrid.findIndex(g => g.timeOrder === order);
        return aiPredLoData[idx];
      }));
      const futureBandXClosed = [...futureBandX, ...futureBandX.slice().reverse()];
      
      if (futureBandX.length >= 2) {
        kmrPlotData.push({
          x: futureBandXClosed,
          y: futureBandY,
          fill: 'toself',
          fillcolor: COLORS.kmr.aiBand.replace('0.06', '0.04'), // Gelecek bandı daha açık
          line: { color: 'transparent' },
          name: 'KMR AI Tahmin Bandı (gelecek)',
          hoverinfo: 'skip',
          type: 'scatter' as const,
          xaxis: 'x',
          yaxis: 'y',
          legendgroup: 'ai_tahmini',
          showlegend: false,
          connectgaps: false
        });
      }
    }
  }

  // KMR actual - timeline grid'e göre map et, eksik noktalar null
  if (showKMR) {
    kmrPlotData.push({
      x: timelineGrid.map(g => g.timeOrder),
      y: timelineGrid.map(g => g.timelinePoint?.kmr ?? null),
      type: 'scatter', mode: 'lines+markers', name: 'KMR',
      line: { color: COLORS.kmr.line, width: 3 },
      marker: { 
        size: timelineGrid.map(g => g.timelinePoint?.kmr !== null ? 10 : 0),
        color: COLORS.kmr.line, 
        line: { color: '#fff', width: 2 } 
      },
      text: timelineGrid.map(g => g.timeKey || ''),
      hovertemplate: '<b>%{text}</b><br>KMR: %{y:.4f}%<extra></extra>',
      connectgaps: true,
      customdata: timelineGrid.map(g => g.timelinePoint ? ({
        timeOrder: g.timeOrder, timeKey: g.timeKey || '', kmr: g.timelinePoint.kmr, kre: g.timelinePoint.kre, gfr: g.timelinePoint.gfr,
        risk: g.timelinePoint.risk_score, riskLevel: g.timelinePoint.risk_level, kmrPred: g.timelinePoint.kmr_pred,
        krePred: g.timelinePoint.kre_pred, gfrPred: g.timelinePoint.gfr_pred,
        kreAnomalyScore: g.timelinePoint.kre_anomaly_score, gfrAnomalyScore: g.timelinePoint.gfr_anomaly_score,
        kreAnomalyFlag: g.timelinePoint.kre_anomaly_flag, gfrAnomalyFlag: g.timelinePoint.gfr_anomaly_flag,
        isAnomaly: false
      }) : null),
      xaxis: 'x', yaxis: 'y'
    });

    // KMR backend anomali flag'leri
    if (showAnomalies) {
      const anomalyPts = timelineGrid.filter(g => g.timelinePoint && g.timelinePoint.kmr_anomaly_flag);
      if (anomalyPts.length > 0) {
        kmrPlotData.push({
          x: anomalyPts.map(g => g.timeOrder),
          y: anomalyPts.map(g => g.timelinePoint!.kmr),
          type: 'scatter', mode: 'markers', name: '⚠️ KMR Anomali (AI)',
          marker: { size: 12, color: COLORS.thresholds.critical, symbol: 'diamond', line: { color: '#fff', width: 2 } },
          text: anomalyPts.map(g => `${g.timeKey} - ANOMALI`),
          hovertemplate: '<b>%{text}</b><br>KMR: %{y:.4f}%<extra></extra>',
          customdata: anomalyPts.map(g => ({
            timeOrder: g.timeOrder, timeKey: g.timeKey || '', kmr: g.timelinePoint!.kmr, kre: g.timelinePoint!.kre, gfr: g.timelinePoint!.gfr,
            risk: g.timelinePoint!.risk_score, riskLevel: g.timelinePoint!.risk_level, kmrPred: g.timelinePoint!.kmr_pred, isAnomaly: true
          })),
          xaxis: 'x', yaxis: 'y'
        });
      }
    }
    
    // KMR klinik eşik tabanlı anomali noktaları (kademeli eşikler) - toggle'a bağlı
    // Kritik: >5% (kırmızı), Orta: >2% (turuncu), <0.5 iyi (marker yok)
    if (kmrShowEşikler) {
      const kmrData = timelineGrid
        .map(g => ({
          x: g.timeOrder,
          y: g.timelinePoint?.kmr ?? null,
          point: g.timelinePoint
        }))
        .filter(d => d.y !== null && typeof d.y === 'number' && !isNaN(d.y));
      
      const kmrCritical = kmrData.filter(d => d.y! > 5.0);
      const kmrModerate = kmrData.filter(d => d.y! > 2.0 && d.y! <= 5.0);
      
      if (kmrShowEşikler && kmrCritical.length > 0) {
        kmrPlotData.push({
          x: kmrCritical.map(d => d.x),
          y: kmrCritical.map(d => d.y),
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: '🔴 KMR Kritik Eşik',
          marker: {
            size: 10,
            color: COLORS.thresholds.critical,
            symbol: 'diamond',
            line: { color: '#fff', width: 1 }
          },
          text: kmrCritical.map(d => `KMR ${d.y!.toFixed(2)}% (kritik >5%)`),
          hovertemplate: '<b>%{text}</b><extra></extra>',
        xaxis: 'x',
        yaxis: 'y',
        showlegend: false
        });
      }
      
    if (kmrShowEşikler && showModerateThresholds && kmrModerate.length > 0) {
      kmrPlotData.push({
        x: kmrModerate.map(d => d.x),
        y: kmrModerate.map(d => d.y),
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: '🟠 KMR Orta Eşik',
        marker: {
          size: 8,
          color: COLORS.thresholds.moderate,
          symbol: 'circle',
          line: { color: '#fff', width: 1 }
        },
        text: kmrModerate.map(d => `KMR ${d.y!.toFixed(2)}% (orta >2%)`),
        hovertemplate: '<b>%{text}</b><extra></extra>',
        xaxis: 'x',
        yaxis: 'y',
        showlegend: false
      });
    }
    }
  }

  // KRE/GFR/Risk data for side panel (not shown in main graph due to scale differences)
  const krePts = timeline.filter((t: TimelinePoint) => t.kre !== null);
  const gfrPts = timeline.filter((t: TimelinePoint) => t.gfr !== null);

  // Threshold lines - timeline grid'e göre (sadece KMR subplot için), yeni grid max'ına göre
  if (kmrShowEşikler && showKMR) {
    allShapes.push(
      { type: 'line', x0: minTimeOrder - 0.5, x1: maxTimeOrder + 0.5, y0: 0.5, y1: 0.5, line: { color: COLORS.thresholds.moderate, width: 1, dash: 'dot' }, yref: 'y', xref: 'x' },
      { type: 'line', x0: minTimeOrder - 0.5, x1: maxTimeOrder + 0.5, y0: 2.0, y1: 2.0, line: { color: COLORS.thresholds.moderate, width: 1, dash: 'dot' }, yref: 'y', xref: 'x' },
      { type: 'line', x0: minTimeOrder - 0.5, x1: maxTimeOrder + 0.5, y0: 5.0, y1: 5.0, line: { color: COLORS.thresholds.critical, width: 1, dash: 'dot' }, yref: 'y', xref: 'x' }
    );
  }
  
  
  // Şeritleri ekle
  allShapes.push(...timelineStripes);

  // KRE/GFR referans bandlarını LAB_TIME_MAP → UNIFIED_TIME_MAP ile map et
  const kreBandsExtended = mapLabBandsToGrid(rawKreBands);
  const gfrBandsExtended = mapLabBandsToGrid(rawGfrBands);

  // KRE/GFR Subplot Data (xaxis='x2', yaxis='y2' for KRE, yaxis='y3' for GFR)
  // KRE referans bandı - en altta, düşük opaklık
  if (kreShowReferenceIQR && kreBandsExtended.length > 0) {
    kreGfrPlotData.push({
      x: [...kreBandsExtended.map(b => b.time_order), ...kreBandsExtended.slice().reverse().map(b => b.time_order)],
      y: [...kreBandsExtended.map(b => b.p75), ...kreBandsExtended.slice().reverse().map(b => b.p25)],
      fill: 'toself', fillcolor: COLORS.kre.referenceIQR, line: { color: 'transparent' },
      name: 'KRE Referans IQR', hoverinfo: 'skip', type: 'scatter' as const, xaxis: 'x2', yaxis: 'y2',
      showlegend: false
    });
  }
  // KRE referans median - ince çizgi, dot dash
  if (kreShowReferenceMedian && kreBandsExtended.length > 0) {
    kreGfrPlotData.push({
      x: kreBandsExtended.map(b => b.time_order),
      y: kreBandsExtended.map(b => b.median),
      type: 'scatter' as const, mode: 'lines' as const, name: 'KRE Referans Median',
      line: { color: COLORS.kre.referenceMedian, width: 1, dash: 'dot' as const }, xaxis: 'x2', yaxis: 'y2',
      showlegend: false
    });
  }
  // GFR referans bandı - en altta, düşük opaklık
  if (gfrShowReferenceIQR && gfrBandsExtended.length > 0) {
    kreGfrPlotData.push({
      x: [...gfrBandsExtended.map(b => b.time_order), ...gfrBandsExtended.slice().reverse().map(b => b.time_order)],
      y: [...gfrBandsExtended.map(b => b.p75), ...gfrBandsExtended.slice().reverse().map(b => b.p25)],
      fill: 'toself', fillcolor: COLORS.gfr.referenceIQR, line: { color: 'transparent' },
      name: 'GFR Referans IQR', hoverinfo: 'skip', type: 'scatter' as const, xaxis: 'x2', yaxis: 'y3',
      showlegend: false
    });
  }
  // GFR referans median - ince çizgi, dot dash
  if (gfrShowReferenceMedian && gfrBandsExtended.length > 0) {
    kreGfrPlotData.push({
      x: gfrBandsExtended.map(b => b.time_order),
      y: gfrBandsExtended.map(b => b.median),
      type: 'scatter' as const, mode: 'lines' as const, name: 'GFR Referans Median',
      line: { color: COLORS.gfr.referenceMedian, width: 1, dash: 'dot' as const }, xaxis: 'x2', yaxis: 'y3',
      showlegend: false
    });
  }
  // KRE trace - boş veri kontrolü, unified order kullanıyor (zaten timelineGrid'de)
  const hasKreData = timelineGrid.some(g => {
    const point = g.timelinePoint;
    return point && typeof point.kre === 'number' && !isNaN(point.kre) && point.kre !== null;
  });
  if (hasKreData) {
    // Sadece null olmayan KRE değerlerini filtrele
    const kreData = timelineGrid
      .map(g => ({
        x: g.timeOrder,
        y: g.timelinePoint?.kre ?? null,
        point: g.timelinePoint
      }))
      .filter(d => d.y !== null && typeof d.y === 'number' && !isNaN(d.y));
    
    if (kreData.length > 0) {
      kreGfrPlotData.push({
        x: kreData.map(d => d.x),
        y: kreData.map(d => d.y),
        type: 'scatter' as const, 
        mode: 'lines+markers' as const, 
        name: 'KRE',
        line: { color: COLORS.kre.line, width: 2 }, 
        marker: { 
          size: kreData.map(d => {
            const point = d.point;
            if (!point || point.kre === null) return 0;
            // Diamond marker for anomalies
            if (point.kre_anomaly_flag && (point.kre_anomaly_score || 0) > 50) {
              return 10;
            }
            return 6; // Marker boyutu küçültüldü
          }),
          color: kreData.map(d => {
            const point = d.point;
            if (point?.kre_anomaly_flag && (point.kre_anomaly_score || 0) > 50) {
              return COLORS.thresholds.critical; // Red for anomalies
            }
            return COLORS.kre.line;
          }),
          symbol: kreData.map(d => {
            const point = d.point;
            if (point?.kre_anomaly_flag && (point.kre_anomaly_score || 0) > 50) {
              return 'diamond'; // Diamond for anomalies
            }
            return 'circle';
          })
        },
        text: kreData.map(d => {
          const point = d.point;
          if (!point || point.kre === null) return '';
          const actual = point.kre.toFixed(2);
          const pred = point.kre_pred ? ` (Tahmin: ${point.kre_pred.toFixed(2)})` : '';
          const anomaly = point.kre_anomaly_flag ? ' ⚠️ ANOMALİ' : '';
          return `${actual}${pred}${anomaly}`;
        }),
        hovertemplate: '<b>KRE</b> (Düşüş iyi ↓)<br>%{text}<extra></extra>',
        connectgaps: false, // Null değerler arasında çizgi çizme
        xaxis: 'x2', 
        yaxis: 'y2',
        showlegend: false
      });
    }
    
    // KRE AI Prediction line - geçmiş ve gelecek olarak iki parça
    const hasKrePred = timelineGrid.some(g => {
      const point = g.timelinePoint;
      return point && typeof point.kre_pred === 'number' && point.kre_pred !== null;
    });
    if (hasKrePred && kreShowAIPrediction) {
      const kreAiPredData = timelineGrid.map(g => {
        if (g.timeOrder >= 1) {
          return g.timelinePoint?.kre_pred ?? null;
        }
        return null;
      });
      
      const kreAiPredLoData = timelineGrid.map(g => {
        if (g.timeOrder >= 1) {
          return g.timelinePoint?.kre_pred_lo ?? null;
        }
        return null;
      });
      
      const kreAiPredHiData = timelineGrid.map(g => {
        if (g.timeOrder >= 1) {
          return g.timelinePoint?.kre_pred_hi ?? null;
        }
        return null;
      });
      
      // Son gerçek KRE noktasını bul
      const actualLastKreOrder = lastKreOrder ?? (timeline.findLast((t: TimelinePoint) => t.kre !== null)?.time_order ?? null);
      
      // Geçmiş tahminler
      const krePastPredData = timelineGrid.map((g, idx) => {
        if (g.timeOrder >= 1 && actualLastKreOrder !== null && g.timeOrder <= actualLastKreOrder) {
          return kreAiPredData[idx];
        }
        return null;
      });
      
      // Gelecek tahminler
      const kreFuturePredData = timelineGrid.map((g, idx) => {
        if (g.timeOrder >= 1 && actualLastKreOrder !== null && g.timeOrder > actualLastKreOrder) {
          return kreAiPredData[idx];
        }
        return null;
      });
      
      // Geçmiş AI tahmini çizgisi
      if (krePastPredData.some(v => v !== null)) {
        kreGfrPlotData.push({
          x: timelineGrid.map(g => g.timeOrder),
          y: krePastPredData,
          type: 'scatter' as const, mode: 'lines' as const, name: 'AI Tahmini',
          line: { color: COLORS.kre.aiLine, width: 2.5, dash: 'dashdot' as const },
          connectgaps: false,
          xaxis: 'x2', yaxis: 'y2',
          showlegend: false,
          legendgroup: 'ai_kre',
          hovertemplate: '<b>AI Tahmini (geçmiş, Düşüş iyi ↓)</b><br>%{x}<br>%{y:.2f}<extra></extra>',
        });
      }
      
      // Gelecek AI tahmini çizgisi (forecast)
      if (kreFuturePredData.some(v => v !== null) && actualLastKreOrder !== null) {
        kreGfrPlotData.push({
          x: timelineGrid.map(g => g.timeOrder),
          y: kreFuturePredData,
          type: 'scatter' as const, mode: 'lines' as const, name: 'AI Tahmini',
          line: { color: COLORS.kre.aiLine, width: 2.5, dash: 'longdash' as const, opacity: 0.7 },
          connectgaps: false,
          xaxis: 'x2', yaxis: 'y2',
          showlegend: false, // Geçmiş ile aynı grup, tek legend satırı
          legendgroup: 'ai_kre',
          hovertemplate: '<b>AI Tahmini (gelecek, Düşüş iyi ↓)</b><br>%{x}<br>%{y:.2f}<extra></extra>'
        });
        
        // Forecast bölgesi gölgesi (alt subplot için)
        allShapes.push({
          type: 'rect',
          x0: actualLastKreOrder + 0.5,
          x1: maxTimeOrder + 0.5,
          y0: 0,
          y1: 0.48,  // Alt subplot domain
          fillcolor: COLORS.kre.forecastShadow,
          line: { width: 0 },
          xref: 'x2',
          yref: 'paper',
          layer: 'below'
        });
      }
      
      // KRE AI Tahmin Bandı (lo/hi) - geçmiş ve gelecek için ayrı bandlar
      const kreLoValid = kreAiPredLoData.filter(v => v !== null && typeof v === 'number' && !isNaN(v));
      const kreHiValid = kreAiPredHiData.filter(v => v !== null && typeof v === 'number' && !isNaN(v));
      const hasValidKreBand = kreLoValid.length >= 2 && kreHiValid.length >= 2;
      
      if (kreShowAIBand && hasValidKreBand && actualLastKreOrder !== null) {
        // Geçmiş band
        const pastBandIndices = timelineGrid
          .map((g, idx) => ({ order: g.timeOrder, idx }))
          .filter(({ order, idx }) => order <= actualLastKreOrder && kreAiPredLoData[idx] !== null && kreAiPredHiData[idx] !== null);
        
        if (pastBandIndices.length >= 2) {
          const pastBandX = pastBandIndices.map(({ order }) => order);
          const pastBandY = [
            ...pastBandIndices.map(({ idx }) => kreAiPredHiData[idx]),
            ...pastBandIndices.slice().reverse().map(({ idx }) => kreAiPredLoData[idx])
          ];
          const pastBandXClosed = [...pastBandX, ...pastBandX.slice().reverse()];
          
          kreGfrPlotData.push({
            x: pastBandXClosed,
            y: pastBandY,
            fill: 'toself',
            fillcolor: COLORS.kre.aiBand,
            line: { color: 'transparent' },
            name: 'KRE AI Tahmin Bandı (geçmiş)',
            hoverinfo: 'skip',
            type: 'scatter' as const,
            xaxis: 'x2',
            yaxis: 'y2',
            legendgroup: 'ai_tahmini',
            showlegend: false,
            connectgaps: false
          });
        }
        
        // Gelecek band
        const futureBandIndices = timelineGrid
          .map((g, idx) => ({ order: g.timeOrder, idx }))
          .filter(({ order, idx }) => order > actualLastKreOrder && kreAiPredLoData[idx] !== null && kreAiPredHiData[idx] !== null);
        
        if (futureBandIndices.length >= 2) {
          const futureBandX = futureBandIndices.map(({ order }) => order);
          const futureBandY = [
            ...futureBandIndices.map(({ idx }) => kreAiPredHiData[idx]),
            ...futureBandIndices.slice().reverse().map(({ idx }) => kreAiPredLoData[idx])
          ];
          const futureBandXClosed = [...futureBandX, ...futureBandX.slice().reverse()];
          
          kreGfrPlotData.push({
            x: futureBandXClosed,
            y: futureBandY,
            fill: 'toself',
            fillcolor: COLORS.kre.aiBand.replace('0.06', '0.04'), // Gelecek bandı daha açık
            line: { color: 'transparent' },
            name: 'KRE AI Tahmin Bandı (gelecek)',
            hoverinfo: 'skip',
            type: 'scatter' as const,
            xaxis: 'x2',
            yaxis: 'y2',
            legendgroup: 'ai_tahmini',
            showlegend: false,
            connectgaps: false
          });
        }
      }
    }
    
    // KRE klinik eşik tabanlı anomali noktaları (kademeli eşikler) - toggle'a bağlı
    // Kritik: >4.5 (kırmızı), Orta: >2.0 (turuncu), <1.2 iyi (marker yok)
    if (kreShowEşikler) {
      const kreCritical = kreData.filter(d => {
        const kre = d.y;
        return kre !== null && typeof kre === 'number' && (kre > 4.5 || kre < 0);
      });
      const kreModerate = kreData.filter(d => {
        const kre = d.y;
        return kre !== null && typeof kre === 'number' && kre > 2.0 && kre <= 4.5;
      });
      
      if (kreShowEşikler && kreCritical.length > 0) {
        kreGfrPlotData.push({
          x: kreCritical.map(d => d.x),
          y: kreCritical.map(d => d.y),
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: '🔴 KRE Kritik Eşik',
          marker: {
            size: 10,
            color: COLORS.thresholds.critical,
            symbol: 'diamond',
            line: { color: '#fff', width: 1 }
          },
          text: kreCritical.map(d => {
            const kre = d.y!;
            if (kre > 4.5) return `KRE ${kre.toFixed(2)} (kritik >4.5)`;
            return `KRE ${kre.toFixed(2)} (geçersiz <0)`;
          }),
          hovertemplate: '<b>%{text}</b><extra></extra>',
          xaxis: 'x2',
          yaxis: 'y2',
          showlegend: false
        });
      }
      
      if (kreShowEşikler && showModerateThresholds && kreModerate.length > 0) {
        kreGfrPlotData.push({
          x: kreModerate.map(d => d.x),
          y: kreModerate.map(d => d.y),
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: '🟠 KRE Orta Eşik',
          marker: {
            size: 8,
            color: COLORS.thresholds.moderate,
            symbol: 'circle',
            line: { color: '#fff', width: 1 }
          },
          text: kreModerate.map(d => `KRE ${d.y!.toFixed(2)} (orta >2.0)`),
          hovertemplate: '<b>%{text}</b><extra></extra>',
          xaxis: 'x2',
          yaxis: 'y2',
          showlegend: false
        });
      }
    }
  }
  // GFR trace - boş veri kontrolü, unified order kullanıyor (zaten timelineGrid'de)
  const hasGfrData = timelineGrid.some(g => {
    const point = g.timelinePoint;
    return point && typeof point.gfr === 'number' && !isNaN(point.gfr) && point.gfr !== null;
  });
  if (hasGfrData) {
    // Sadece null olmayan GFR değerlerini filtrele
    const gfrData = timelineGrid
      .map(g => ({
        x: g.timeOrder,
        y: g.timelinePoint?.gfr ?? null,
        point: g.timelinePoint
      }))
      .filter(d => d.y !== null && typeof d.y === 'number' && !isNaN(d.y));
    
    if (gfrData.length > 0) {
      kreGfrPlotData.push({
        x: gfrData.map(d => d.x),
        y: gfrData.map(d => d.y),
        type: 'scatter' as const, 
        mode: 'lines+markers' as const, 
        name: 'GFR',
        line: { color: COLORS.gfr.line, width: 2 }, 
        marker: { 
          size: gfrData.map(d => {
            const point = d.point;
            if (!point || point.gfr === null) return 0;
            // Diamond marker for anomalies
            if (point.gfr_anomaly_flag && (point.gfr_anomaly_score || 0) > 50) {
              return 10;
            }
            return 6; // Marker boyutu küçültüldü
          }),
          color: gfrData.map(d => {
            const point = d.point;
            if (point?.gfr_anomaly_flag && (point.gfr_anomaly_score || 0) > 50) {
              return COLORS.thresholds.critical; // Red for anomalies
            }
            return COLORS.gfr.line;
          }),
          symbol: gfrData.map(d => {
            const point = d.point;
            if (point?.gfr_anomaly_flag && (point.gfr_anomaly_score || 0) > 50) {
              return 'diamond'; // Diamond for anomalies
            }
            return 'circle';
          })
        },
        text: gfrData.map(d => {
          const point = d.point;
          if (!point || point.gfr === null) return '';
          const actual = point.gfr.toFixed(0);
          const pred = point.gfr_pred ? ` (Tahmin: ${point.gfr_pred.toFixed(0)})` : '';
          const anomaly = point.gfr_anomaly_flag ? ' ⚠️ ANOMALİ' : '';
          return `GFR=${actual}${pred}${anomaly}`;
        }),
        hovertemplate: '<b>GFR</b> (Yüksek iyi ↑)<br>%{text}<extra></extra>',
        connectgaps: false, // Null değerler arasında çizgi çizme
        xaxis: 'x2', 
        yaxis: 'y3',
        showlegend: false
      });
    }
    
    // GFR AI Prediction line - geçmiş ve gelecek olarak iki parça
    const hasGfrPred = timelineGrid.some(g => {
      const point = g.timelinePoint;
      return point && typeof point.gfr_pred === 'number' && point.gfr_pred !== null;
    });
    if (hasGfrPred && gfrShowAIPrediction) {
      const gfrAiPredData = timelineGrid.map(g => {
        if (g.timeOrder >= 1) {
          return g.timelinePoint?.gfr_pred ?? null;
        }
        return null;
      });
      
      const gfrAiPredLoData = timelineGrid.map(g => {
        if (g.timeOrder >= 1) {
          return g.timelinePoint?.gfr_pred_lo ?? null;
        }
        return null;
      });
      
      const gfrAiPredHiData = timelineGrid.map(g => {
        if (g.timeOrder >= 1) {
          return g.timelinePoint?.gfr_pred_hi ?? null;
        }
        return null;
      });
      
      // Son gerçek GFR noktasını bul
      const actualLastGfrOrder = lastGfrOrder ?? (timeline.findLast((t: TimelinePoint) => t.gfr !== null)?.time_order ?? null);
      
      // Geçmiş tahminler
      const gfrPastPredData = timelineGrid.map((g, idx) => {
        if (g.timeOrder >= 1 && actualLastGfrOrder !== null && g.timeOrder <= actualLastGfrOrder) {
          return gfrAiPredData[idx];
        }
        return null;
      });
      
      // Gelecek tahminler
      const gfrFuturePredData = timelineGrid.map((g, idx) => {
        if (g.timeOrder >= 1 && actualLastGfrOrder !== null && g.timeOrder > actualLastGfrOrder) {
          return gfrAiPredData[idx];
        }
        return null;
      });
      
      // Geçmiş AI tahmini çizgisi
      if (gfrPastPredData.some(v => v !== null)) {
        kreGfrPlotData.push({
          x: timelineGrid.map(g => g.timeOrder),
          y: gfrPastPredData,
          type: 'scatter' as const, mode: 'lines' as const, name: 'GFR AI Tahmini',
          line: { color: COLORS.gfr.aiLine, width: 2.5, dash: 'dashdot' as const },
          connectgaps: false,
          xaxis: 'x2', yaxis: 'y3',
          showlegend: false,
          legendgroup: 'ai_gfr',
          hovertemplate: '<b>AI Tahmini (geçmiş, Yüksek iyi ↑)</b><br>%{x}<br>%{y:.0f}<extra></extra>'
        });
      }
      
      // Gelecek AI tahmini çizgisi (forecast)
      if (gfrFuturePredData.some(v => v !== null) && actualLastGfrOrder !== null) {
        kreGfrPlotData.push({
          x: timelineGrid.map(g => g.timeOrder),
          y: gfrFuturePredData,
          type: 'scatter' as const, mode: 'lines' as const, name: 'AI Tahmini',
          line: { color: COLORS.gfr.aiLine, width: 2.5, dash: 'longdash' as const, opacity: 0.7 },
          connectgaps: false,
          xaxis: 'x2', yaxis: 'y3',
          showlegend: false, // Geçmiş ile aynı grup, tek legend satırı
          legendgroup: 'ai_gfr',
          hovertemplate: '<b>AI Tahmini (gelecek, Yüksek iyi ↑)</b><br>%{x}<br>%{y:.0f}<extra></extra>'
        });
        
        // Forecast bölgesi gölgesi (GFR için)
        allShapes.push({
          type: 'rect',
          x0: actualLastGfrOrder + 0.5,
          x1: maxTimeOrder + 0.5,
          y0: 0,
          y1: 0.48,  // Alt subplot domain
          fillcolor: COLORS.gfr.forecastShadow,
          line: { width: 0 },
          xref: 'x2',
          yref: 'paper',
          layer: 'below'
        });
      }
      
      // GFR AI Tahmin Bandı (lo/hi) - geçmiş ve gelecek için ayrı bandlar
      const gfrLoValid = gfrAiPredLoData.filter(v => v !== null && typeof v === 'number' && !isNaN(v));
      const gfrHiValid = gfrAiPredHiData.filter(v => v !== null && typeof v === 'number' && !isNaN(v));
      const hasValidGfrBand = gfrLoValid.length >= 2 && gfrHiValid.length >= 2;
      
      if (gfrShowAIBand && hasValidGfrBand && actualLastGfrOrder !== null) {
        // Geçmiş band
        const pastBandIndices = timelineGrid
          .map((g, idx) => ({ order: g.timeOrder, idx }))
          .filter(({ order, idx }) => order <= actualLastGfrOrder && gfrAiPredLoData[idx] !== null && gfrAiPredHiData[idx] !== null);
        
        if (pastBandIndices.length >= 2) {
          const pastBandX = pastBandIndices.map(({ order }) => order);
          const pastBandY = [
            ...pastBandIndices.map(({ idx }) => gfrAiPredHiData[idx]),
            ...pastBandIndices.slice().reverse().map(({ idx }) => gfrAiPredLoData[idx])
          ];
          const pastBandXClosed = [...pastBandX, ...pastBandX.slice().reverse()];
          
          kreGfrPlotData.push({
            x: pastBandXClosed,
            y: pastBandY,
            fill: 'toself',
            fillcolor: COLORS.gfr.aiBand,
            line: { color: 'transparent' },
            name: 'GFR AI Tahmin Bandı (geçmiş)',
            hoverinfo: 'skip',
            type: 'scatter' as const,
            xaxis: 'x2',
            yaxis: 'y3',
            legendgroup: 'ai_tahmini',
            showlegend: false,
            connectgaps: false
          });
        }
        
        // Gelecek band
        const futureBandIndices = timelineGrid
          .map((g, idx) => ({ order: g.timeOrder, idx }))
          .filter(({ order, idx }) => order > actualLastGfrOrder && gfrAiPredLoData[idx] !== null && gfrAiPredHiData[idx] !== null);
        
        if (futureBandIndices.length >= 2) {
          const futureBandX = futureBandIndices.map(({ order }) => order);
          const futureBandY = [
            ...futureBandIndices.map(({ idx }) => gfrAiPredHiData[idx]),
            ...futureBandIndices.slice().reverse().map(({ idx }) => gfrAiPredLoData[idx])
          ];
          const futureBandXClosed = [...futureBandX, ...futureBandX.slice().reverse()];
          
          kreGfrPlotData.push({
            x: futureBandXClosed,
            y: futureBandY,
            fill: 'toself',
            fillcolor: COLORS.gfr.aiBand.replace('0.06', '0.04'), // Gelecek bandı daha açık
            line: { color: 'transparent' },
            name: 'GFR AI Tahmin Bandı (gelecek)',
            hoverinfo: 'skip',
            type: 'scatter' as const,
            xaxis: 'x2',
            yaxis: 'y3',
            legendgroup: 'ai_tahmini',
            showlegend: false,
            connectgaps: false
          });
        }
      }
    }
    
    // GFR klinik eşik tabanlı anomali noktaları (kademeli eşikler)
    // Kritik: <15 (kırmızı), Orta: <30 (turuncu), <60 bilgilendirme (marker yok)
    // GFR klinik eşik tabanlı anomali noktaları (kademeli eşikler) - toggle'a bağlı
    // Kritik: <15 (kırmızı), Orta: <30 (turuncu), ≥90 iyi (marker yok)
    if (gfrShowEşikler) {
      const gfrCritical = gfrData.filter(d => {
        const gfr = d.y;
        return gfr !== null && typeof gfr === 'number' && gfr < 15;
      });
      const gfrModerate = gfrData.filter(d => {
        const gfr = d.y;
        return gfr !== null && typeof gfr === 'number' && gfr >= 15 && gfr < 30;
      });
      
      if (gfrShowEşikler && gfrCritical.length > 0) {
        kreGfrPlotData.push({
          x: gfrCritical.map(d => d.x),
          y: gfrCritical.map(d => d.y),
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: '🔴 GFR Kritik Eşik',
          marker: {
            size: 10,
            color: COLORS.thresholds.critical,
            symbol: 'diamond',
            line: { color: '#fff', width: 1 }
          },
          text: gfrCritical.map(d => `GFR ${d.y!.toFixed(0)} (kritik <15)`),
          hovertemplate: '<b>%{text}</b><extra></extra>',
          xaxis: 'x2',
          yaxis: 'y3',
          showlegend: false
        });
      }
      
      if (gfrShowEşikler && showModerateThresholds && gfrModerate.length > 0) {
        kreGfrPlotData.push({
          x: gfrModerate.map(d => d.x),
          y: gfrModerate.map(d => d.y),
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: '🟠 GFR Orta Eşik',
          marker: {
            size: 8,
            color: COLORS.thresholds.moderate,
            symbol: 'circle',
            line: { color: '#fff', width: 1 }
          },
          text: gfrModerate.map(d => `GFR ${d.y!.toFixed(0)} (orta <30)`),
          hovertemplate: '<b>%{text}</b><extra></extra>',
          xaxis: 'x2',
          yaxis: 'y3',
          showlegend: false
        });
      }
    }
  }

  // LAB Cohort trajectory - KRE/GFR için benzer hastalar overlay (improved LAB cohort'tan)
  if (labCohortTrajectory) {
    const labCohortKreMap = new Map(labCohortTrajectory.trajectory.map(t => [t.time_order, t.expected_kre]));
    const labCohortGfrMap = new Map(labCohortTrajectory.trajectory.map(t => [t.time_order, t.expected_gfr]));
    
    // KRE cohort trajectory - Benzer Hastalar
    const hasKreCohort = Array.from(labCohortKreMap.values()).some(v => v !== null && typeof v === 'number');
    if (kreShowCohort && hasKreCohort) {
      kreGfrPlotData.push({
        x: timelineGrid.map(g => g.timeOrder),
        y: timelineGrid.map(g => labCohortKreMap.get(g.timeOrder) ?? null),
        type: 'scatter' as const, mode: 'lines' as const, name: 'Benzer Hastalar KRE',
        line: { color: COLORS.kre.cohort, width: 1.5, dash: 'dot' as const },
        connectgaps: true, xaxis: 'x2', yaxis: 'y2',
        showlegend: false,
        legendgroup: 'benzer_hastalar',
        legendgrouptitle: { text: 'Benzer Hastalar' }
      });
    }
    
    // GFR cohort trajectory - Benzer Hastalar
    if (gfrShowCohort && hasGfrCohort) {
      kreGfrPlotData.push({
        x: timelineGrid.map(g => g.timeOrder),
        y: timelineGrid.map(g => labCohortGfrMap.get(g.timeOrder) ?? null),
        type: 'scatter' as const, mode: 'lines' as const, name: 'Benzer Hastalar GFR',
        line: { color: COLORS.gfr.cohort, width: 1.5, dash: 'dot' as const },
        connectgaps: true, xaxis: 'x2', yaxis: 'y3',
        showlegend: false,
        legendgroup: 'benzer_hastalar',
        legendgrouptitle: { text: 'Benzer Hastalar' }
      });
    }
  }

  // Dinamik eksen aralıkları hesaplama (KRE ve GFR için)
  // Tüm veri kaynaklarını toplayıp maksimum değerleri bul
  let kreMax = 0;
  let gfrMax = 0;
  
  // KRE için maksimum değerleri topla
  if (hasKreData) {
    // Gerçek hasta verileri
    const kreActualValues = timelineGrid
      .map(g => g.timelinePoint?.kre)
      .filter((v): v is number => v !== null && typeof v === 'number' && !isNaN(v));
    if (kreActualValues.length > 0) {
      kreMax = Math.max(kreMax, ...kreActualValues);
    }
    
    // AI tahminleri
    const krePredValues = timelineGrid
      .map(g => g.timelinePoint?.kre_pred)
      .filter((v): v is number => v !== null && typeof v === 'number' && !isNaN(v));
    if (krePredValues.length > 0) {
      kreMax = Math.max(kreMax, ...krePredValues);
    }
    
    // Referans band (p75)
    if (kreBandsExtended.length > 0) {
      const kreBandMax = Math.max(...kreBandsExtended.map(b => b.p75).filter(v => !isNaN(v)));
      kreMax = Math.max(kreMax, kreBandMax);
    }
    
    // Cohort trajectory
    if (labCohortTrajectory) {
      const kreCohortValues = labCohortTrajectory.trajectory
        .map(t => t.expected_kre)
        .filter((v): v is number => v !== null && typeof v === 'number' && !isNaN(v));
      if (kreCohortValues.length > 0) {
        kreMax = Math.max(kreMax, ...kreCohortValues);
      }
    }
  }
  
  // GFR için maksimum değerleri topla
  if (hasGfrData) {
    // Gerçek hasta verileri
    const gfrActualValues = timelineGrid
      .map(g => g.timelinePoint?.gfr)
      .filter((v): v is number => v !== null && typeof v === 'number' && !isNaN(v));
    if (gfrActualValues.length > 0) {
      gfrMax = Math.max(gfrMax, ...gfrActualValues);
    }
    
    // AI tahminleri
    const gfrPredValues = timelineGrid
      .map(g => g.timelinePoint?.gfr_pred)
      .filter((v): v is number => v !== null && typeof v === 'number' && !isNaN(v));
    if (gfrPredValues.length > 0) {
      gfrMax = Math.max(gfrMax, ...gfrPredValues);
    }
    
    // Referans band (p75)
    if (gfrBandsExtended.length > 0) {
      const gfrBandMax = Math.max(...gfrBandsExtended.map(b => b.p75).filter(v => !isNaN(v)));
      gfrMax = Math.max(gfrMax, gfrBandMax);
    }
    
    // Cohort trajectory
    if (labCohortTrajectory) {
      const gfrCohortValues = labCohortTrajectory.trajectory
        .map(t => t.expected_gfr)
        .filter((v): v is number => v !== null && typeof v === 'number' && !isNaN(v));
      if (gfrCohortValues.length > 0) {
        gfrMax = Math.max(gfrMax, ...gfrCohortValues);
      }
    }
  }
  
  // KRE dinamik range: minimum 6, maksimum değerin %15 üstü, eşik değerlerini de dikkate al
  const kreThreshold = 4.5; // Kritik eşik
  const kreModerateThreshold = 2.0; // Orta eşik
  const kreRange: [number, number] = [
    0,
    Math.max(6, kreMax * 1.15, kreThreshold * 1.2, kreModerateThreshold * 1.5)
  ];
  
  // GFR dinamik range: minimum 120, maksimum değerin %10 üstü, eşik değerlerini de dikkate al
  const gfrThreshold = 15; // Kritik eşik
  const gfrModerateThreshold = 30; // Orta eşik
  const gfrGoodThreshold = 90; // İyi eşik
  const gfrRange: [number, number] = [
    0,
    Math.max(120, gfrMax * 1.1, gfrThreshold * 1.5, gfrModerateThreshold * 1.3, gfrGoodThreshold * 1.1)
  ];

  // KRE/GFR eşik çizgileri (sadece çizgiler, fill yok) - toggle'a bağlı
  if (hasKreData && kreShowEşikler) {
    allShapes.push(
      // KRE kritik eşik çizgisi (>4.5)
      { 
        type: 'line', 
        x0: minTimeOrder - 0.5, 
        x1: maxTimeOrder + 0.5, 
        y0: 4.5, 
        y1: 4.5, 
        line: { color: COLORS.thresholds.critical, width: 1, dash: 'dash' }, 
        yref: 'y2', 
        xref: 'x2'
      },
      // KRE orta eşik çizgisi (>2.0) - sadece toggle açıksa
      ...(showModerateThresholds ? [{
        type: 'line' as const, 
        x0: minTimeOrder - 0.5, 
        x1: maxTimeOrder + 0.5, 
        y0: 2.0, 
        y1: 2.0, 
        line: { color: COLORS.thresholds.moderate, width: 1, dash: 'dash' }, 
        yref: 'y2' as const, 
        xref: 'x2' as const
      }] : [])
    );
  }
  
  if (hasGfrData && gfrShowEşikler) {
    allShapes.push(
      // GFR kritik eşik çizgisi (<15)
      { 
        type: 'line', 
        x0: minTimeOrder - 0.5, 
        x1: maxTimeOrder + 0.5, 
        y0: 15, 
        y1: 15, 
        line: { color: COLORS.thresholds.critical, width: 1, dash: 'dash' }, 
        yref: 'y3', 
        xref: 'x2'
      },
      // GFR orta eşik çizgisi (<30) - sadece toggle açıksa
      ...(showModerateThresholds ? [{
        type: 'line' as const, 
        x0: minTimeOrder - 0.5, 
        x1: maxTimeOrder + 0.5, 
        y0: 30, 
        y1: 30, 
        line: { color: COLORS.thresholds.moderate, width: 1, dash: 'dash' }, 
        yref: 'y3' as const, 
        xref: 'x2' as const
      }] : [])
    );
  }

  // Birleştirilmiş data - subplots için
  const allPlotData = [...kmrPlotData, ...kreGfrPlotData];

  // Veri kontrolü: Eğer hiç çizilecek veri yoksa uyarı göster
  const hasAnyPlotData = allPlotData.length > 0 || timelineGrid.some(g => g.timelinePoint !== null);

  // Tüm zaman noktalarını göster (Day_1'den Month_12'ye kadar)
  // timelineGrid zaten tüm zaman noktalarını içeriyor (1-22)
  const finalTickOrders = timelineGrid.map(g => g.timeOrder);
  const finalTickTexts = timelineGrid.map(g => g.timeKey || `Order ${g.timeOrder}`);

  // Ana layout - sabit split görünüm + yan panel
  return (
    <div className="flex flex-col min-h-[100svh] bg-white">
      <div className="flex flex-col md:flex-row flex-1 bg-white gap-1.5 md:gap-0">
        {/* Chart area - sol taraf */}
        <div className="flex-[1_1_0] flex flex-col min-w-0">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-4 md:px-6 bg-gradient-to-r from-slate-50 to-white text-slate-800 shadow-sm">
          <div className="flex items-center gap-6">
            <Link href="/patients"><Button variant="ghost" size="sm" className="text-slate-700 hover:bg-slate-100"><ArrowLeft className="h-4 w-4 mr-2" />Geri</Button></Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Hasta {meta.patient_code}</h1>
              <p className="text-xs text-slate-600">{formatGender(meta.gender)} • {meta.age} yaş • {formatVitalStatus(meta.vital_status)}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-md ${
              last_status.risk_level_last === 'Normal' ? 'bg-green-500' :
              last_status.risk_level_last === 'Dikkat' ? 'bg-yellow-500 text-yellow-900' :
              last_status.risk_level_last === 'Kritik' ? 'bg-orange-500' : 'bg-red-600'
            }`}>
              {last_status.risk_level_last} ({last_status.risk_last.toFixed(0)})
            </div>
            {meta.improved_proxy && (
              <div className="px-3 py-1 rounded-lg bg-green-500 text-xs font-medium">✓ İyileşmiş Hasta</div>
            )}
          </div>
        </div>

        {/* Charts area - unified subplots (KMR üstte, KRE/GFR altta) */}
        <div className="flex-1 p-3 md:p-4 bg-white overflow-y-auto overflow-x-visible relative"> {/* Gradient kaldırıldı, relative eklendi, overflow-x visible */}
          {!hasAnyPlotData ? (
            <div className="flex items-center justify-center h-full min-h-[560px]">
              <div className="text-center">
                <div className="text-yellow-500 text-xl mb-2">⚠️</div>
                <p className="text-lg font-medium">Grafik verisi bulunamadı</p>
                <p className="text-sm text-muted-foreground">Bu hasta için çizilecek veri yok</p>
              </div>
            </div>
          ) : (
          <>
          <div ref={plotRef} className="w-full relative" style={{ height: 'clamp(560px, 75vh, 900px)', minHeight: '560px' }}>
            <Plot 
              data={allPlotData} 
              layout={{
                grid: {
                  rows: 2,
                  columns: 1,
                  pattern: 'independent',
                  roworder: 'top to bottom',
                  xaxes: ['x', 'x2'],
                  yaxes: ['y', 'y2', 'y3'] // y2: KRE (sol), y3: GFR (sağ, overlaying y2)
                },
                // Shared x-axis (x ve x2 aynı domain'i paylaşır) - tick yoğunluğu azaltıldı
                xaxis: { 
                  title: '', 
                  tickmode: 'array', 
                  tickvals: finalTickOrders,
                  ticktext: finalTickTexts, // Üst grafikte tüm zaman etiketleri göster
                  tickangle: -45, // Daha dik açı ile daha fazla yer
                  tickfont: { size: 8 }, // Font boyutu küçültüldü
                  gridcolor: '#e2e8f0',
                  zeroline: false,
                  showticklabels: true, // Üst grafikte etiketleri göster
                  domain: [0, 1], // Üst subplot için tam genişlik
                  anchor: 'y', // y-axis'e anchor
                  range: [minTimeOrder - 0.5, maxTimeOrder + 0.5] // Son ayı kesmeden göster
                },
                xaxis2: { 
                  title: 'Zaman Noktası', 
                  tickmode: 'array', 
                  tickvals: finalTickOrders,
                  ticktext: finalTickTexts, // Alt grafikte tüm zaman etiketleri göster
                  tickangle: -45, // Daha dik açı ile daha fazla yer
                  tickfont: { size: 7 }, // Font boyutu küçültüldü
                  gridcolor: '#e2e8f0',
                  domain: [0, 1], // Alt subplot için tam genişlik (y-axis domain ile ayrılır)
                  anchor: 'y2', // y2'ye anchor (KRE ekseni)
                  range: [minTimeOrder - 0.5, maxTimeOrder + 0.5], // Son ayı kesmeden göster
                  showticklabels: true // Alt subplot'ta etiketleri göster
                },
                // KMR y-axis
                yaxis: { 
                  title: { text: 'KMR (%)', font: { size: 11, color: COLORS.kmr.line } }, 
                  side: 'left', 
                  rangemode: 'tozero', 
                  gridcolor: '#e2e8f0',
                  tickfont: { size: 10, color: COLORS.kmr.line },
                  zeroline: true,
                  zerolinecolor: '#cbd5e1',
                  showticklabels: true,
                  automargin: true,
                  domain: [0.58, 1] // Üst subplot - alt ile boşluk bırakıldı
                },
                // KRE y-axis (alt subplot, sol) - yaxis2
                yaxis2: { 
                  title: { text: 'KRE (Düşüş iyi ↓)', font: { size: 10, color: COLORS.kre.line } }, 
                  side: 'left', 
                  anchor: 'x2', // Alt subplot x-axis'ine anchor
                  rangemode: 'tozero', 
                  gridcolor: '#e2e8f0',
                  showgrid: true, // Grid açık
                  tickfont: { size: 9, color: COLORS.kre.line },
                  domain: [0, 0.45], // Alt subplot - üst ile boşluk bırakıldı, alt bar için yer
                  range: kreRange // KRE için dinamik aralık
                },
                // GFR y-axis (alt subplot, sağ) - yaxis3 overlaying yaxis2
                yaxis3: { 
                  title: { text: 'GFR (Yüksek iyi ↑)', font: { size: 10, color: COLORS.gfr.line } }, 
                  side: 'right', 
                  anchor: 'x2', // Alt subplot x-axis'ine anchor
                  overlaying: 'y2', // y2 üzerine bindir
                  rangemode: 'tozero', 
                  showgrid: false, // Grid kapalı (KRE grid'i gösteriliyor)
                  tickfont: { size: 9, color: COLORS.gfr.line },
                  domain: [0, 0.45], // Alt subplot - üst ile boşluk bırakıldı, alt bar için yer
                  range: gfrRange // GFR için dinamik aralık
                },
                margin: { t: 50, b: 120, l: 50, r: 40 }, // Margin'ler optimize edildi, bottom artırıldı (alt bar ve tüm tarih etiketleri için yer)
                title: {
                  text: 'KMR Zaman Serisi Analizi',
                  font: { size: 14, color: '#1e293b' },
                  x: 0.5,
                  xanchor: 'center',
                  y: 0.98,
                  yref: 'paper'
                },
                legend: { 
                  visible: false // Legend tamamen kapalı, bilgiler alt bar'da
                },
                paper_bgcolor: '#fff', 
                plot_bgcolor: '#fff', // Gri arka planı kaldır 
                shapes: allShapes, 
                hovermode: 'x unified' // Unified hover across subplots
              }} 
              config={{ responsive: true, displayModeBar: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'], modeBarButtonsToAdd: ['autoScale2d'] }} 
              style={{ width: '100%', height: '100%', minHeight: '640px' }}
              onInitialized={(figure, graphDiv) => {
                if (graphDiv) {
                  const plotDiv = graphDiv as { on?: (event: string, callback: (data: { points: Array<{ customdata?: PinnedPointInfo; pointIndex: number; x: number }> }) => void) => void };
                  if (typeof plotDiv.on === 'function') {
                    // Click handler
                    plotDiv.on('plotly_click', (data: { points: Array<{ customdata?: PinnedPointInfo; pointIndex: number; x: number }> }) => {
                      if (data.points && data.points.length > 0) {
                        const point = data.points[0];
                        if (point.customdata) {
                          setPinnedPoint(point.customdata);
                          setPinnedPointHighlight(true);
                          setTimeout(() => setPinnedPointHighlight(false), 1000);
                        } else {
                          // Fallback: find by x value (time_order) - timeline grid'den bul
                          const timeOrder = point.x;
                          const gridItem = timelineGrid.find(g => g.timeOrder === timeOrder);
                          if (gridItem?.timelinePoint) {
                            const newPinned: PinnedPointInfo = {
                              timeOrder: gridItem.timeOrder, timeKey: gridItem.timeKey || '', kmr: gridItem.timelinePoint.kmr, kre: gridItem.timelinePoint.kre,
                              gfr: gridItem.timelinePoint.gfr, risk: gridItem.timelinePoint.risk_score, riskLevel: gridItem.timelinePoint.risk_level, 
                              kmrPred: gridItem.timelinePoint.kmr_pred, krePred: gridItem.timelinePoint.kre_pred, gfrPred: gridItem.timelinePoint.gfr_pred,
                              kreAnomalyScore: gridItem.timelinePoint.kre_anomaly_score, gfrAnomalyScore: gridItem.timelinePoint.gfr_anomaly_score,
                              kreAnomalyFlag: gridItem.timelinePoint.kre_anomaly_flag, gfrAnomalyFlag: gridItem.timelinePoint.gfr_anomaly_flag,
                              isAnomaly: gridItem.timelinePoint.kmr_anomaly_flag
                            };
                            setPinnedPoint(newPinned);
                            setPinnedPointHighlight(true);
                            setTimeout(() => setPinnedPointHighlight(false), 1000);
                          }
                        }
                      }
                    });
                    // Hover handler kaldırıldı - sadece pinned kullanılıyor
                  }
                }
              }}
            />
          </div>
          
          {/* Alt Bar - Grafik container içinde, grafiklerin hemen altında, sticky */}
          <div className="sticky bottom-0 left-0 right-0 z-10 bg-white/98 backdrop-blur-sm border-t-2 border-slate-300 shadow-lg mt-2">
            <div className="px-3 md:px-4 py-3">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                {/* Blok 1: Klinik Eşikler */}
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Klinik Eşikler</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300 text-[10px] font-medium">KMR &lt;0.5% İyi</span>
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 text-[10px] font-medium">KMR &gt;2% Orta</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-medium">KMR &gt;5% Kritik</span>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300 text-[10px] font-medium">KRE &lt;1.2 İyi</span>
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 text-[10px] font-medium">KRE &gt;2.0 Orta</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-medium">KRE &gt;4.5 Kritik</span>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300 text-[10px] font-medium">GFR ≥90 İyi</span>
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 text-[10px] font-medium">GFR &lt;30 Orta</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-medium">GFR &lt;15 Kritik</span>
                  </div>
                </div>

                {/* Blok 2: Katman Kontrolleri - Grafik bazlı mikro-toggle'lar */}
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Katman Kontrolleri</div>
                  <div className="space-y-1.5">
                    {/* KMR Kontrolleri */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium" style={{ color: COLORS.kmr.line, width: '2.5rem' }}>KMR:</span>
                      <button onClick={() => setKmrShowReference(!kmrShowReference)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kmrShowReference ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kmrShowReference ? { backgroundColor: '#fef3c7', color: '#92400e', borderColor: COLORS.kmr.referenceMedian } : {}}>Ref</button>
                      <button onClick={() => setKmrShowAI(!kmrShowAI)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kmrShowAI ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kmrShowAI ? { backgroundColor: '#d1fae5', color: '#065f46', borderColor: COLORS.kmr.aiLine } : {}}>AI</button>
                      <button onClick={() => setKmrShowCohort(!kmrShowCohort)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kmrShowCohort ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kmrShowCohort ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: COLORS.kmr.cohort } : {}}>Benzer</button>
                      <button onClick={() => setKmrShowBand(!kmrShowBand)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kmrShowBand ? 'bg-gray-200 text-gray-800 border-gray-400' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>Band</button>
                      <button onClick={() => setKmrShowEşikler(!kmrShowEşikler)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kmrShowEşikler ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kmrShowEşikler ? { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: COLORS.thresholds.critical } : {}}>Eşik</button>
                    </div>
                    {/* KRE Kontrolleri */}
                    {hasKreData && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium w-10" style={{ color: COLORS.kre.line }}>KRE:</span>
                        <button onClick={() => setKreShowReference(!kreShowReference)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kreShowReference ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kreShowReference ? { backgroundColor: '#fef3c7', color: '#92400e', borderColor: COLORS.kre.referenceMedian } : {}}>Ref</button>
                        <button onClick={() => setKreShowAI(!kreShowAI)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kreShowAI ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kreShowAI ? { backgroundColor: '#ede9fe', color: '#5b21b6', borderColor: COLORS.kre.aiLine } : {}}>AI</button>
                        <button onClick={() => setKreShowCohort(!kreShowCohort)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kreShowCohort ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kreShowCohort ? { backgroundColor: '#f3e8ff', color: '#7c3aed', borderColor: COLORS.kre.cohort } : {}}>Benzer</button>
                        <button onClick={() => setKreShowBand(!kreShowBand)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kreShowBand ? 'bg-gray-200 text-gray-800 border-gray-400' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>Band</button>
                        <button onClick={() => setKreShowEşikler(!kreShowEşikler)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${kreShowEşikler ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={kreShowEşikler ? { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: COLORS.thresholds.critical } : {}}>Eşik</button>
                      </div>
                    )}
                    {/* GFR Kontrolleri */}
                    {hasGfrData && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium w-10" style={{ color: COLORS.gfr.line }}>GFR:</span>
                        <button onClick={() => setGfrShowReference(!gfrShowReference)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${gfrShowReference ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={gfrShowReference ? { backgroundColor: '#e0f2fe', color: '#0c4a6e', borderColor: COLORS.gfr.referenceMedian } : {}}>Ref</button>
                        <button onClick={() => setGfrShowAI(!gfrShowAI)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${gfrShowAI ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={gfrShowAI ? { backgroundColor: '#cffafe', color: '#164e63', borderColor: COLORS.gfr.aiLine } : {}}>AI</button>
                        <button onClick={() => setGfrShowCohort(!gfrShowCohort)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${gfrShowCohort ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={gfrShowCohort ? { backgroundColor: '#cffafe', color: '#155e75', borderColor: COLORS.gfr.cohort } : {}}>Benzer</button>
                        <button onClick={() => setGfrShowBand(!gfrShowBand)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${gfrShowBand ? 'bg-gray-200 text-gray-800 border-gray-400' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>Band</button>
                        <button onClick={() => setGfrShowEşikler(!gfrShowEşikler)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${gfrShowEşikler ? '' : 'bg-gray-100 text-gray-600 border-gray-300'}`} style={gfrShowEşikler ? { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: COLORS.thresholds.critical } : {}}>Eşik</button>
                      </div>
                    )}
                    {/* Orta Eşikler Toggle (ortak) */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                      <button onClick={() => setShowModerateThresholds(!showModerateThresholds)} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${showModerateThresholds ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                        {showModerateThresholds ? '✓' : '○'} Orta Eşikler
                      </button>
                    </div>
                  </div>
                </div>

                {/* Blok 3: Durum Özetleri */}
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Durum Özetleri</div>
                  <div className="flex flex-wrap gap-1.5">
                    <div className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-300 text-[10px] font-medium flex items-center gap-1">
                      <span>KMR:</span>
                      <span className="font-bold">
                        {pinnedPoint?.kmr !== null && pinnedPoint?.kmr !== undefined 
                          ? `${pinnedPoint.kmr.toFixed(3)}%`
                          : patient?.last_status?.kmr_last !== null && patient?.last_status?.kmr_last !== undefined 
                            ? `${patient.last_status.kmr_last.toFixed(3)}%` 
                            : '-'}
                      </span>
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-300 text-[10px] font-medium flex items-center gap-1">
                      <span>KRE:</span>
                      <span className="font-bold">
                        {pinnedPoint?.kre !== null && pinnedPoint?.kre !== undefined 
                          ? pinnedPoint.kre.toFixed(2)
                          : patient?.last_status?.kre_last !== null && patient?.last_status?.kre_last !== undefined 
                            ? patient.last_status.kre_last.toFixed(2) 
                            : '-'}
                      </span>
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-300 text-[10px] font-medium flex items-center gap-1">
                      <span>GFR:</span>
                      <span className="font-bold">
                        {pinnedPoint?.gfr !== null && pinnedPoint?.gfr !== undefined 
                          ? pinnedPoint.gfr.toFixed(0)
                          : patient?.last_status?.gfr_last !== null && patient?.last_status?.gfr_last !== undefined 
                            ? patient.last_status.gfr_last.toFixed(0) 
                            : '-'}
                      </span>
                    </div>
                    <div 
                      className="px-2 py-0.5 rounded-full border text-[10px] font-medium flex items-center gap-1"
                      style={{ 
                        backgroundColor: `${RISK_COLORS[(pinnedPoint?.riskLevel ?? patient?.last_status?.risk_level_last) as RiskLevel] || '#666'}20`,
                        color: RISK_COLORS[(pinnedPoint?.riskLevel ?? patient?.last_status?.risk_level_last) as RiskLevel] || '#666',
                        borderColor: RISK_COLORS[(pinnedPoint?.riskLevel ?? patient?.last_status?.risk_level_last) as RiskLevel] || '#666'
                      }}
                    >
                      <span>Risk:</span>
                      <span className="font-bold">{pinnedPoint?.riskLevel ?? patient?.last_status?.risk_level_last || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
        </div>

        {/* Resizable panel - sağ taraf - snap breakpoint'leri ile, mobilde üstte */}
        <div className="bg-slate-50 border-t-2 md:border-t-0 md:border-l-2 border-slate-300 shadow-2xl relative flex flex-col overflow-y-auto w-full md:w-[352px] lg:w-[380px] order-first md:order-last">
        {/* Panel header */}
        <div className="p-3 md:p-4 border-b-2 border-slate-300 bg-slate-50">
          <h3 className="text-sm uppercase tracking-wide font-bold text-slate-900 mb-1">
            📊 Detaylı Analiz Paneli
            {pinnedPoint && (
              <span className="text-xs normal-case text-slate-600 ml-2">({pinnedPoint.timeKey})</span>
            )}
            {!pinnedPoint && timeline.length > 0 && (
              <span className="text-xs normal-case text-slate-600 ml-2">({timeline[timeline.length - 1]?.time_key || 'Son nokta'})</span>
            )}
          </h3>
          {pinnedPoint ? (
            <p className="text-xs text-slate-600 flex items-center gap-1">
              📍 Seçili: <span className="font-semibold">{pinnedPoint.timeKey}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500">Grafik noktasına tıklayarak analiz görüntüleyin</p>
          )}
        </div>

        {/* Özet üst şerit - 3 mini kart + risk etiketi tek satırda */}
        <div className="p-2 md:p-3 border-b-2 border-slate-300 bg-white grid grid-cols-4 gap-1.5">
          <div className="bg-blue-50 rounded-lg p-2 text-center border-2 border-blue-300">
            <div className="text-xs uppercase tracking-wide text-blue-700 font-semibold mb-1">Son KMR</div>
            <div className="text-lg font-bold text-blue-900">
              {pinnedPoint?.kmr !== null && pinnedPoint?.kmr !== undefined 
                ? `${pinnedPoint.kmr.toFixed(3)}%`
                : timeline.length > 0 
                  ? timeline[timeline.length - 1].kmr?.toFixed(3) ?? '-' 
                  : '-'}%
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 text-center border-2 border-purple-300">
            <div className="text-xs uppercase tracking-wide text-purple-700 font-semibold mb-1">Son KRE</div>
            <div className="text-lg font-bold text-purple-900">
              {pinnedPoint?.kre !== null && pinnedPoint?.kre !== undefined 
                ? pinnedPoint.kre.toFixed(2)
                : krePts.length > 0 
                  ? krePts[krePts.length - 1].kre?.toFixed(2) 
                  : '-'}
            </div>
          </div>
          <div className="bg-cyan-50 rounded-lg p-2 text-center border-2 border-cyan-300">
            <div className="text-xs uppercase tracking-wide text-cyan-700 font-semibold mb-1">Son GFR</div>
            <div className="text-lg font-bold text-cyan-900">
              {pinnedPoint?.gfr !== null && pinnedPoint?.gfr !== undefined 
                ? pinnedPoint.gfr.toFixed(0)
                : gfrPts.length > 0 
                  ? gfrPts[gfrPts.length - 1].gfr?.toFixed(0) 
                  : '-'}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center border-2 border-red-300">
            <div className="text-xs uppercase tracking-wide text-red-700 font-semibold mb-1">Risk</div>
            <div className="text-lg font-bold" style={{ color: RISK_COLORS[timeline[timeline.length - 1]?.risk_level as RiskLevel] || '#666' }}>
              {timeline[timeline.length - 1]?.risk_score?.toFixed(0) || '-'}
            </div>
            <div className="text-xs text-slate-600 font-medium">{timeline[timeline.length - 1]?.risk_level || '-'}</div>
          </div>
        </div>

        {/* Download/Share butonları */}
        <div className="p-2 border-b border-slate-200 bg-white flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs h-7 border-slate-300"
            onClick={() => {
              if (plotRef.current) {
                const plotlyDiv = plotRef.current.querySelector('.js-plotly-plot') as any;
                if (plotlyDiv && (window as any).Plotly) {
                  (window as any).Plotly.downloadImage(plotlyDiv, { format: 'png', width: 1200, height: 800, filename: `hasta-${meta.patient_code}-grafik` });
                }
              }
            }}
          >
            📥 PNG
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs h-7 border-slate-300"
            onClick={() => {
              // PDF için window.print() kullanılabilir veya jsPDF ile özel PDF oluşturulabilir
              window.print();
            }}
          >
            📄 PDF
          </Button>
        </div>



            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-slate-50" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
              {/* Dynamic Pinned Point Analysis */}
              {pinnedPoint ? (() => {
                const currentIdx = timeline.findIndex((t: TimelinePoint) => t.time_order === pinnedPoint.timeOrder);
                const prevPoint = currentIdx > 0 ? timeline[currentIdx - 1] : null;
                const nextPoint = currentIdx < timeline.length - 1 ? timeline[currentIdx + 1] : null;
                const kmrDiff = prevPoint?.kmr != null && pinnedPoint.kmr != null ? pinnedPoint.kmr - prevPoint.kmr : null;
                const kreDiff = prevPoint?.kre != null && pinnedPoint.kre != null ? pinnedPoint.kre - prevPoint.kre : null;
                const gfrDiff = prevPoint?.gfr != null && pinnedPoint.gfr != null ? pinnedPoint.gfr - prevPoint.gfr : null;
                const predError = pinnedPoint.kmr != null && pinnedPoint.kmrPred != null ? pinnedPoint.kmr - pinnedPoint.kmrPred : null;
                
                return (
                  <div className={`bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 md:p-4 shadow-md border-2 border-purple-300 transition-all duration-300 ${pinnedPointHighlight ? 'animate-pulse ring-2 ring-purple-400' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-purple-800 text-sm flex items-center gap-2">
                        📍 {pinnedPoint.timeKey} Analizi
                        {pinnedPoint.isAnomaly && <span className="text-red-500 text-xs bg-red-100 px-2 py-0.5 rounded">⚠️ ANOMALİ</span>}
                      </h4>
                      <Button variant="ghost" size="sm" onClick={() => setPinnedPoint(null)} className="h-6 w-6 p-0 text-purple-600 hover:bg-purple-100">✕</Button>
                    </div>

                    {/* Tek Nokta Özeti */}
                    <div className="bg-white/90 rounded-lg p-2 mb-2 border border-purple-200">
                      <div className="text-xs font-semibold text-purple-700 mb-1.5">📊 Nokta Özeti</div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">KMR:</span>
                          <span className="font-bold text-blue-600">{pinnedPoint.kmr?.toFixed(3) ?? '-'}%</span>
                        </div>
                        {pinnedPoint.kre !== null && pinnedPoint.kre !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">KRE:</span>
                            <span className="font-bold text-purple-600">{pinnedPoint.kre.toFixed(2)}</span>
                          </div>
                        )}
                        {pinnedPoint.gfr !== null && pinnedPoint.gfr !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">GFR:</span>
                            <span className="font-bold text-cyan-600">{pinnedPoint.gfr.toFixed(0)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-600">Risk:</span>
                          <span className="font-bold" style={{ color: RISK_COLORS[pinnedPoint.riskLevel as RiskLevel] || '#666' }}>
                            {pinnedPoint.riskLevel || '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Current Values */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-white/80 rounded-lg p-2 text-center border border-blue-200">
                        <div className="text-lg font-bold text-blue-600">{pinnedPoint.kmr?.toFixed(3) ?? '-'}%</div>
                        <div className="text-xs text-slate-500">KMR</div>
                      </div>
                      {pinnedPoint.kre !== null && pinnedPoint.kre !== undefined && (
                        <div className="bg-white/80 rounded-lg p-2 text-center border border-purple-200">
                          <div className="text-lg font-bold text-purple-600">{pinnedPoint.kre.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">KRE</div>
                        </div>
                      )}
                      {pinnedPoint.gfr !== null && pinnedPoint.gfr !== undefined && (
                        <div className="bg-white/80 rounded-lg p-2 text-center border border-cyan-200">
                          <div className="text-lg font-bold text-cyan-600">{pinnedPoint.gfr.toFixed(0)}</div>
                          <div className="text-xs text-slate-500">GFR</div>
                        </div>
                      )}
                      {(() => {
                        // Klinik eşiklere göre risk_level override (yumuşatılmış, kademeli)
                        let overrideRiskLevel: RiskLevel = pinnedPoint.riskLevel as RiskLevel;
                        let overrideColor = RISK_COLORS[overrideRiskLevel] || '#666';
                        const severityLevels: RiskLevel[] = ['Normal', 'Dikkat', 'Kritik', 'Çok Kritik'];
                        
                        // Her metrik için ayrı ayrı ciddiyet hesapla, en yükseğini al
                        let maxSeverity: RiskLevel = 'Normal';
                        
                        // KMR eşikleri: >5% kritik, >2% orta
                        if (pinnedPoint.kmr !== null && pinnedPoint.kmr !== undefined) {
                          if (pinnedPoint.kmr > 5.0) {
                            maxSeverity = 'Çok Kritik';
                          } else if (pinnedPoint.kmr > 2.0 && maxSeverity === 'Normal') {
                            maxSeverity = 'Dikkat';
                          }
                        }
                        
                        // KRE eşikleri: >4.5 kritik, >2.0 orta
                        if (pinnedPoint.kre !== null && pinnedPoint.kre !== undefined) {
                          if (pinnedPoint.kre > 4.5 || pinnedPoint.kre < 0) {
                            maxSeverity = 'Çok Kritik';
                          } else if (pinnedPoint.kre > 2.0) {
                            const kreSeverity: RiskLevel = maxSeverity === 'Normal' ? 'Dikkat' : maxSeverity;
                            if (severityLevels.indexOf(kreSeverity) > severityLevels.indexOf(maxSeverity)) {
                              maxSeverity = kreSeverity;
                            }
                          }
                        }
                        
                        // GFR eşikleri: <15 kritik, <30 orta
                        if (pinnedPoint.gfr !== null && pinnedPoint.gfr !== undefined) {
                          if (pinnedPoint.gfr < 15 || pinnedPoint.gfr > 120) {
                            maxSeverity = 'Çok Kritik';
                          } else if (pinnedPoint.gfr < 30) {
                            const gfrSeverity: RiskLevel = maxSeverity === 'Normal' ? 'Dikkat' : maxSeverity;
                            if (severityLevels.indexOf(gfrSeverity) > severityLevels.indexOf(maxSeverity)) {
                              maxSeverity = gfrSeverity;
                            }
                          }
                        }
                        
                        // Override sadece mevcut seviyeden daha yüksekse uygula
                        if (severityLevels.indexOf(maxSeverity) > severityLevels.indexOf(overrideRiskLevel)) {
                          overrideRiskLevel = maxSeverity;
                          overrideColor = RISK_COLORS[overrideRiskLevel];
                        }
                        
                        return (
                          <div className="bg-white/80 rounded-lg p-2 text-center border border-red-200">
                            <div className="text-lg font-bold" style={{ color: overrideColor }}>
                              {pinnedPoint.risk?.toFixed(0) ?? '-'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {overrideRiskLevel !== pinnedPoint.riskLevel && '⚠️ '}
                              {overrideRiskLevel || 'Risk'}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Değişim Analizi - Önceki noktaya göre */}
                    {prevPoint && (kmrDiff !== null || kreDiff !== null || gfrDiff !== null) && (
                      <div className="bg-indigo-50 rounded-lg border border-indigo-200 mb-2 p-3">
                        <h5 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
                          📊 Değişim Analizi
                          <span className="text-[10px] font-normal text-indigo-600">({prevPoint.time_key} → {pinnedPoint.timeKey})</span>
                        </h5>
                        <div className="space-y-1.5 text-xs">
                          {kmrDiff !== null && (
                            <div className="flex justify-between items-center p-1.5 bg-white/80 rounded border border-indigo-100">
                              <span className="text-slate-700 font-medium">KMR Δ:</span>
                              <span className={`font-bold font-mono ${kmrDiff > 0 ? 'text-red-600' : kmrDiff < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                {kmrDiff > 0 ? '↑' : kmrDiff < 0 ? '↓' : '→'} {Math.abs(kmrDiff).toFixed(4)}%
                              </span>
                            </div>
                          )}
                          {kreDiff !== null && (
                            <div className="flex justify-between items-center p-1.5 bg-white/80 rounded border border-indigo-100">
                              <span className="text-slate-700 font-medium">KRE Δ:</span>
                              <span className={`font-bold font-mono ${kreDiff > 0 ? 'text-red-600' : kreDiff < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                {kreDiff > 0 ? '↑' : kreDiff < 0 ? '↓' : '→'} {Math.abs(kreDiff).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {gfrDiff !== null && (
                            <div className="flex justify-between items-center p-1.5 bg-white/80 rounded border border-indigo-100">
                              <span className="text-slate-700 font-medium">GFR Δ:</span>
                              <span className={`font-bold font-mono ${gfrDiff < 0 ? 'text-red-600' : gfrDiff > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                {gfrDiff > 0 ? '↑' : gfrDiff < 0 ? '↓' : '→'} {Math.abs(gfrDiff).toFixed(0)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* AI Prediction - Collapsible */}
                    {(pinnedPoint.kmrPred !== null || pinnedPoint.krePred !== null || pinnedPoint.gfrPred !== null) && (
                      <div className="bg-emerald-50 rounded-lg border border-emerald-200 mb-2 overflow-hidden">
                        <button 
                          onClick={() => dispatchExpanded({ type: 'TOGGLE', section: 'thresholds' })}
                          className="w-full p-2 flex items-center justify-between text-xs text-emerald-700 hover:bg-emerald-100"
                        >
                          <span className="font-bold">
                            🤖 AI Tahmin
                            {(() => {
                              const isForecast = (pinnedPoint.timeOrder > (lastKmrOrder ?? 0)) || 
                                                (pinnedPoint.timeOrder > (lastKreOrder ?? 0)) || 
                                                (pinnedPoint.timeOrder > (lastGfrOrder ?? 0));
                              return isForecast ? ' (gelecek)' : ' (geçmiş)';
                            })()}
                          </span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedSections.thresholds ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.thresholds && (
                        <div className="px-3 pb-2 space-y-1 text-xs">
                          {pinnedPoint.kmrPred !== null && (
                            <>
                              <div className="font-semibold text-slate-700 mb-1">KMR:</div>
                              <div className="flex justify-between"><span>Tahmin:</span><span className="font-mono">{pinnedPoint.kmrPred.toFixed(4)}%</span></div>
                              {pinnedPoint.kmr !== null && (
                                <>
                                  <div className="flex justify-between"><span>Gerçek:</span><span className="font-mono">{pinnedPoint.kmr.toFixed(4)}%</span></div>
                                  {predError !== null && (
                                    <>
                                      <div className="flex justify-between">
                                        <span>Hata:</span>
                                        <span className={`font-bold ${Math.abs(predError) > 0.5 ? 'text-orange-600' : 'text-green-600'}`}>
                                          {predError.toFixed(4)}%
                                        </span>
                                      </div>
                                      {pinnedPoint.kmr !== null && pinnedPoint.kmr !== 0 && (
                                        <div className="flex justify-between">
                                          <span>Hata %:</span>
                                          <span className={`font-bold ${Math.abs(predError / pinnedPoint.kmr * 100) > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                                            {(predError / pinnedPoint.kmr * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </>
                          )}
                          {pinnedPoint.krePred !== null && (
                            <>
                              <div className="font-semibold text-purple-700 mb-1 mt-2">KRE:</div>
                              <div className="flex justify-between"><span>Tahmin:</span><span className="font-mono">{pinnedPoint.krePred.toFixed(2)}</span></div>
                              {pinnedPoint.kre !== null && (
                                <>
                                  <div className="flex justify-between"><span>Gerçek:</span><span className="font-mono">{pinnedPoint.kre.toFixed(2)}</span></div>
                                  <div className="flex justify-between">
                                    <span>Fark:</span>
                                    <span className={`font-bold ${Math.abs(pinnedPoint.kre - pinnedPoint.krePred) > 0.5 ? 'text-orange-600' : 'text-green-600'}`}>
                                      {(pinnedPoint.kre - pinnedPoint.krePred).toFixed(2)}
                                    </span>
                                  </div>
                                  {pinnedPoint.kre !== 0 && (
                                    <div className="flex justify-between">
                                      <span>Fark %:</span>
                                      <span className={`font-bold ${Math.abs((pinnedPoint.kre - pinnedPoint.krePred) / pinnedPoint.kre * 100) > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                                        {((pinnedPoint.kre - pinnedPoint.krePred) / pinnedPoint.kre * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                          {pinnedPoint.gfrPred !== null && (
                            <>
                              <div className="font-semibold text-cyan-700 mb-1 mt-2">GFR:</div>
                              <div className="flex justify-between"><span>Tahmin:</span><span className="font-mono">{pinnedPoint.gfrPred.toFixed(0)}</span></div>
                              {pinnedPoint.gfr !== null && (
                                <>
                                  <div className="flex justify-between"><span>Gerçek:</span><span className="font-mono">{pinnedPoint.gfr.toFixed(0)}</span></div>
                                  <div className="flex justify-between">
                                    <span>Fark:</span>
                                    <span className={`font-bold ${Math.abs(pinnedPoint.gfr - pinnedPoint.gfrPred) > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                                      {(pinnedPoint.gfr - pinnedPoint.gfrPred).toFixed(0)}
                                    </span>
                                  </div>
                                  {pinnedPoint.gfr !== 0 && (
                                    <div className="flex justify-between">
                                      <span>Fark %:</span>
                                      <span className={`font-bold ${Math.abs((pinnedPoint.gfr - pinnedPoint.gfrPred) / pinnedPoint.gfr * 100) > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                                        {((pinnedPoint.gfr - pinnedPoint.gfrPred) / pinnedPoint.gfr * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                        )}
                      </div>
                    )}

                    {/* LAB Risk & Anomaly Warnings */}
                    {(pinnedPoint.kre !== null || pinnedPoint.gfr !== null || pinnedPoint.kreAnomalyFlag || pinnedPoint.gfrAnomalyFlag) && (
                      <div className="bg-purple-50 rounded-lg border border-purple-200 mb-2 overflow-hidden">
                        <button 
                          onClick={() => dispatchExpanded({ type: 'TOGGLE', section: 'metrics' })}
                          className="w-full p-2 flex items-center justify-between text-xs text-purple-700 hover:bg-purple-100"
                        >
                          <span className="font-bold">🧪 LAB Analizi</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedSections.metrics ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.metrics && (
                          <div className="px-3 pb-2 space-y-2 text-xs">
                            {/* KRE Status */}
                            {pinnedPoint.kre !== null && (
                              <div className="bg-white/80 rounded p-2 border border-purple-200">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold text-purple-700">KRE:</span>
                                  <span className={`font-bold ${
                                    pinnedPoint.kre < 1.2 ? 'text-green-600' :
                                    pinnedPoint.kre > 4.5 ? 'text-red-600' :
                                    'text-orange-600'
                                  }`}>
                                    {pinnedPoint.kre.toFixed(2)}
                                  </span>
                                </div>
                                {pinnedPoint.kre < 1.2 && <div className="text-green-700 text-xs">✅ Çok iyi</div>}
                                {pinnedPoint.kre >= 1.2 && pinnedPoint.kre <= 4.5 && <div className="text-orange-700 text-xs">⚠️ İzlem gerekli</div>}
                                {pinnedPoint.kre > 4.5 && <div className="text-red-700 text-xs font-bold">🚨 Çok kötü - Acil müdahale!</div>}
                                {pinnedPoint.kreAnomalyFlag && pinnedPoint.kreAnomalyScore !== null && pinnedPoint.kreAnomalyScore > 50 && (
                                  <div className="text-red-700 text-xs font-bold mt-1">⚠️ ANOMALİ (Skor: {pinnedPoint.kreAnomalyScore.toFixed(0)})</div>
                                )}
                              </div>
                            )}
                            
                            {/* GFR Status */}
                            {pinnedPoint.gfr !== null && (
                              <div className="bg-white/80 rounded p-2 border border-cyan-200">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-semibold text-cyan-700">GFR:</span>
                                  <span className={`font-bold ${
                                    pinnedPoint.gfr >= 90 ? 'text-green-600' :
                                    pinnedPoint.gfr < 15 ? 'text-red-600' :
                                    'text-orange-600'
                                  }`}>
                                    {pinnedPoint.gfr.toFixed(0)}
                                  </span>
                                </div>
                                {pinnedPoint.gfr >= 90 && <div className="text-green-700 text-xs">✅ Çok iyi</div>}
                                {pinnedPoint.gfr >= 15 && pinnedPoint.gfr < 90 && <div className="text-orange-700 text-xs">⚠️ İzlem gerekli</div>}
                                {pinnedPoint.gfr < 15 && <div className="text-red-700 text-xs font-bold">🚨 Çok kötü - Acil müdahale!</div>}
                                {pinnedPoint.gfrAnomalyFlag && pinnedPoint.gfrAnomalyScore !== null && pinnedPoint.gfrAnomalyScore > 50 && (
                                  <div className="text-red-700 text-xs font-bold mt-1">⚠️ ANOMALİ (Skor: {pinnedPoint.gfrAnomalyScore.toFixed(0)})</div>
                                )}
                              </div>
                            )}
                            
                            {/* Trend Warnings */}
                            {kreDiff !== null && kreDiff > 0.5 && (
                              <div className="bg-red-100 border border-red-300 rounded p-1.5 text-red-800 text-xs font-bold">
                                ⚠️ KRE hızlı artıyor! (Son 2 ölçümde +{kreDiff.toFixed(2)})
                              </div>
                            )}
                            {gfrDiff !== null && gfrDiff < -10 && (
                              <div className="bg-red-100 border border-red-300 rounded p-1.5 text-red-800 text-xs font-bold">
                                ⚠️ GFR hızlı düşüyor! (Son 2 ölçümde {gfrDiff.toFixed(0)})
                              </div>
                            )}
                            
                            {/* Improvement Indicators */}
                            {kreDiff !== null && kreDiff < -0.3 && pinnedPoint.kre !== null && pinnedPoint.kre < 1.2 && (
                              <div className="bg-green-100 border border-green-300 rounded p-1.5 text-green-800 text-xs font-bold">
                                ✅ KRE iyileşiyor - Olumlu seyir
                              </div>
                            )}
                            {gfrDiff !== null && gfrDiff > 5 && pinnedPoint.gfr !== null && pinnedPoint.gfr >= 60 && (
                              <div className="bg-green-100 border border-green-300 rounded p-1.5 text-green-800 text-xs font-bold">
                                ✅ GFR iyileşiyor - Olumlu seyir
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clinical Evaluation - Collapsible */}
                    <div className={`rounded-lg border-2 overflow-hidden mb-2 ${
                      pinnedPoint.kmr != null && pinnedPoint.kmr < 0.5 ? 'bg-green-50 border-green-300' :
                      pinnedPoint.kmr != null && pinnedPoint.kmr < 2 ? 'bg-yellow-50 border-yellow-300' :
                      pinnedPoint.kmr != null && pinnedPoint.kmr < 5 ? 'bg-orange-50 border-orange-300' : 'bg-red-50 border-red-300'
                    }`}>
                      <button 
                        onClick={() => dispatchExpanded({ type: 'TOGGLE', section: 'clinical' })}
                        className="w-full p-2 flex items-center justify-between text-xs hover:opacity-80"
                      >
                        <span className="font-bold">💡 Klinik Öneriler</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${expandedSections.clinical ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedSections.clinical && (
                      <div className="px-3 pb-2 space-y-1 text-xs">
                        {pinnedPoint.kmr != null && pinnedPoint.kmr < 0.5 && (
                          <>
                            <div>✅ KMR normal sınırlarda</div>
                            <div>• Rutin takip yeterli</div>
                          </>
                        )}
                        {pinnedPoint.kmr != null && pinnedPoint.kmr >= 0.5 && pinnedPoint.kmr < 2 && (
                          <>
                            <div>⚠️ KMR dikkat gerektiriyor</div>
                            <div>• Yakın izlem önerilir</div>
                          </>
                        )}
                        {pinnedPoint.kmr != null && pinnedPoint.kmr >= 2 && pinnedPoint.kmr < 5 && (
                          <>
                            <div>🔶 KMR kritik seviyede</div>
                            <div>• Acil hematolog konsültasyonu</div>
                            <div>• DLI değerlendirmesi</div>
                          </>
                        )}
                        {pinnedPoint.kmr != null && pinnedPoint.kmr >= 5 && (
                          <>
                            <div>🚨 KMR çok kritik!</div>
                            <div>• ACİL müdahale gerekli</div>
                          </>
                        )}
                        {kmrDiff !== null && kmrDiff > 0.5 && <div className="text-red-700 font-bold">⚠️ Hızlı artış!</div>}
                        {kmrDiff !== null && kmrDiff < -0.5 && <div className="text-green-700 font-bold">✅ İyileşme</div>}
                      </div>
                      )}
                    </div>

                    {/* Navigation - Genişletilmiş kısa yol butonları */}
                    <div className="space-y-2 mt-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={!prevPoint} onClick={() => {
                          if (prevPoint) {
                            const newPinned: PinnedPointInfo = {
                              timeOrder: prevPoint.time_order, timeKey: prevPoint.time_key, kmr: prevPoint.kmr, kre: prevPoint.kre,
                              gfr: prevPoint.gfr, risk: prevPoint.risk_score, riskLevel: prevPoint.risk_level, kmrPred: prevPoint.kmr_pred,
                              krePred: prevPoint.kre_pred ?? null, gfrPred: prevPoint.gfr_pred ?? null,
                              kreAnomalyScore: prevPoint.kre_anomaly_score ?? null, gfrAnomalyScore: prevPoint.gfr_anomaly_score ?? null,
                              kreAnomalyFlag: prevPoint.kre_anomaly_flag ?? false, gfrAnomalyFlag: prevPoint.gfr_anomaly_flag ?? false,
                              isAnomaly: prevPoint.kmr_anomaly_flag
                            };
                            setPinnedPoint(newPinned);
                            setPinnedPointHighlight(true);
                            setTimeout(() => setPinnedPointHighlight(false), 1000);
                          }
                        }} className="flex-1 text-xs border-slate-300">← Önceki</Button>
                        <Button variant="outline" size="sm" disabled={!nextPoint} onClick={() => {
                          if (nextPoint) {
                            const newPinned: PinnedPointInfo = {
                              timeOrder: nextPoint.time_order, timeKey: nextPoint.time_key, kmr: nextPoint.kmr, kre: nextPoint.kre,
                              gfr: nextPoint.gfr, risk: nextPoint.risk_score, riskLevel: nextPoint.risk_level, kmrPred: nextPoint.kmr_pred,
                              krePred: nextPoint.kre_pred ?? null, gfrPred: nextPoint.gfr_pred ?? null,
                              kreAnomalyScore: nextPoint.kre_anomaly_score ?? null, gfrAnomalyScore: nextPoint.gfr_anomaly_score ?? null,
                              kreAnomalyFlag: nextPoint.kre_anomaly_flag ?? false, gfrAnomalyFlag: nextPoint.gfr_anomaly_flag ?? false,
                              isAnomaly: nextPoint.kmr_anomaly_flag
                            };
                            setPinnedPoint(newPinned);
                            setPinnedPointHighlight(true);
                            setTimeout(() => setPinnedPointHighlight(false), 1000);
                          }
                        }} className="flex-1 text-xs border-slate-300">Sonraki →</Button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => {
                          const firstPoint = timeline[0];
                          if (firstPoint) {
                            const newPinned: PinnedPointInfo = {
                              timeOrder: firstPoint.time_order, timeKey: firstPoint.time_key, kmr: firstPoint.kmr, kre: firstPoint.kre,
                              gfr: firstPoint.gfr, risk: firstPoint.risk_score, riskLevel: firstPoint.risk_level, kmrPred: firstPoint.kmr_pred,
                              krePred: firstPoint.kre_pred ?? null, gfrPred: firstPoint.gfr_pred ?? null,
                              kreAnomalyScore: firstPoint.kre_anomaly_score ?? null, gfrAnomalyScore: firstPoint.gfr_anomaly_score ?? null,
                              kreAnomalyFlag: firstPoint.kre_anomaly_flag ?? false, gfrAnomalyFlag: firstPoint.gfr_anomaly_flag ?? false,
                              isAnomaly: firstPoint.kmr_anomaly_flag
                            };
                            setPinnedPoint(newPinned);
                            setPinnedPointHighlight(true);
                            setTimeout(() => setPinnedPointHighlight(false), 1000);
                          }
                        }} className="text-xs h-7 border-slate-300">⏮ İlk</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const lastPoint = timeline[timeline.length - 1];
                          if (lastPoint) {
                            const newPinned: PinnedPointInfo = {
                              timeOrder: lastPoint.time_order, timeKey: lastPoint.time_key, kmr: lastPoint.kmr, kre: lastPoint.kre,
                              gfr: lastPoint.gfr, risk: lastPoint.risk_score, riskLevel: lastPoint.risk_level, kmrPred: lastPoint.kmr_pred,
                              krePred: lastPoint.kre_pred ?? null, gfrPred: lastPoint.gfr_pred ?? null,
                              kreAnomalyScore: lastPoint.kre_anomaly_score ?? null, gfrAnomalyScore: lastPoint.gfr_anomaly_score ?? null,
                              kreAnomalyFlag: lastPoint.kre_anomaly_flag ?? false, gfrAnomalyFlag: lastPoint.gfr_anomaly_flag ?? false,
                              isAnomaly: lastPoint.kmr_anomaly_flag
                            };
                            setPinnedPoint(newPinned);
                            setPinnedPointHighlight(true);
                            setTimeout(() => setPinnedPointHighlight(false), 1000);
                          }
                        }} className="text-xs h-7 border-slate-300">⏭ Son</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const maxRiskPoint = timeline.reduce((max: TimelinePoint | null, t: TimelinePoint) => {
                            if (!max || (t.risk_score != null && (max.risk_score == null || t.risk_score > max.risk_score))) return t;
                            return max;
                          }, null);
                          if (maxRiskPoint) {
                            const newPinned: PinnedPointInfo = {
                              timeOrder: maxRiskPoint.time_order, timeKey: maxRiskPoint.time_key, kmr: maxRiskPoint.kmr, kre: maxRiskPoint.kre,
                              gfr: maxRiskPoint.gfr, risk: maxRiskPoint.risk_score, riskLevel: maxRiskPoint.risk_level, kmrPred: maxRiskPoint.kmr_pred,
                              krePred: maxRiskPoint.kre_pred ?? null, gfrPred: maxRiskPoint.gfr_pred ?? null,
                              kreAnomalyScore: maxRiskPoint.kre_anomaly_score ?? null, gfrAnomalyScore: maxRiskPoint.gfr_anomaly_score ?? null,
                              kreAnomalyFlag: maxRiskPoint.kre_anomaly_flag ?? false, gfrAnomalyFlag: maxRiskPoint.gfr_anomaly_flag ?? false,
                              isAnomaly: maxRiskPoint.kmr_anomaly_flag
                            };
                            setPinnedPoint(newPinned);
                            setPinnedPointHighlight(true);
                            setTimeout(() => setPinnedPointHighlight(false), 1000);
                          }
                        }} className="text-xs h-7 border-slate-300">⚠️ Max Risk</Button>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-300">
                  <p className="text-xs text-slate-500">📍 Grafik noktasına tıklayarak analiz görüntüleyin</p>
                </div>
              )}

              {/* Stats panel with better styling */}
              {stats && stats.totalPoints > 0 && (
              <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border-2 border-slate-300">
                <h4 className="text-sm uppercase tracking-wide font-bold text-slate-900 mb-2 flex items-center gap-2">
                  📉 KMR İstatistikleri
                  {pinnedPoint && (
                    <span className="text-xs normal-case text-slate-600 font-normal">({pinnedPoint.timeKey}&apos;a kadar)</span>
                  )}
                </h4>
                <div className="space-y-2 text-xs">
                  {stats.kmrMin !== null && stats.kmrMax !== null && (
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border-2 border-slate-300">
                      <span className="text-slate-700 font-medium">
                        Min / Max
                        {pinnedPoint && <span className="text-[10px] text-slate-500 ml-1">({pinnedPoint.timeKey}&apos;a kadar)</span>}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{stats.kmrMin.toFixed(3)}% - {stats.kmrMax.toFixed(3)}%</span>
                    </div>
                  )}
                  {stats.kmrMean !== null && !isNaN(stats.kmrMean) && (
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border-2 border-slate-300">
                      <span className="text-slate-700 font-medium">
                        Ortalama
                        {pinnedPoint && <span className="text-[10px] text-slate-500 ml-1">({pinnedPoint.timeKey}&apos;a kadar)</span>}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{stats.kmrMean.toFixed(4)}%</span>
                    </div>
                  )}
                  {stats.kmrTrend !== null && !isNaN(stats.kmrTrend) && (
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border-2 border-slate-300">
                      <span className="text-slate-700 font-medium">
                        Trend
                        {pinnedPoint && <span className="text-[10px] text-slate-500 ml-1">({pinnedPoint.timeKey}&apos;a kadar)</span>}
                      </span>
                      <span className={`font-mono font-bold flex items-center gap-1 ${stats.kmrTrend < 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {stats.kmrTrend < 0 ? '↓' : '↑'} {stats.kmrTrend.toFixed(4)}
                        <span className="text-xs ml-1">{stats.kmrTrend < 0 ? '(İyileşme)' : '(Dikkat)'}</span>
                      </span>
                    </div>
                  )}
                  {stats.kmrCV !== null && !isNaN(stats.kmrCV) && (
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border-2 border-slate-300">
                      <span className="text-slate-700 font-medium">
                        Volatilite (CV)
                        {pinnedPoint && <span className="text-[10px] text-slate-500 ml-1">({pinnedPoint.timeKey}&apos;a kadar)</span>}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{(stats.kmrCV * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border-2 border-slate-300">
                    <span className="text-slate-700 font-medium">
                      Anomali Sayısı
                      {pinnedPoint && <span className="text-[10px] text-slate-500 ml-1">({pinnedPoint.timeKey}&apos;a kadar)</span>}
                    </span>
                    <span className={`font-mono font-bold ${stats.anomalyCount > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                      {stats.anomalyCount} / {stats.totalPoints}
                    </span>
                  </div>
                </div>
              </div>
              )}

              {/* Clinical recommendations with better styling - Filtrelenebilir */}
              <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border-2 border-slate-300">
                <h4 className="text-sm uppercase tracking-wide font-bold text-slate-900 mb-2 flex items-center gap-2">🏥 Klinik Öneriler</h4>
                {/* Filtre sekmeleri */}
                <div className="flex gap-1 mb-2 border-b-2 border-slate-200">
                  {(['all', 'action', 'watch', 'info'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setClinicalTab(filter)}
                      className={`px-3 py-1 text-xs font-semibold border-b-2 transition-colors ${
                        clinicalTab === filter
                          ? 'border-blue-500 text-blue-700' 
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {filter === 'all' ? 'Tümü' : filter === 'action' ? 'Aksiyon' : filter === 'watch' ? 'İzlem' : 'Bilgi'}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {filteredRecommendations.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-4">Öneri yok</div>
                  ) : (
                    filteredRecommendations
                      .filter(rec => rec.text && rec.text.trim() !== '')
                      .map((rec, i) => (
                        <div key={i} className={`text-xs p-3 rounded-lg shadow-sm border-2 ${
                          rec.type === 'success' ? 'bg-green-50 text-green-900 border-green-400' :
                          rec.type === 'warning' ? 'bg-yellow-50 text-yellow-900 border-yellow-400' :
                          rec.type === 'danger' ? 'bg-red-50 text-red-900 border-red-400' :
                          'bg-blue-50 text-blue-900 border-blue-400'
                        }`}>
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-base">
                              {rec.type === 'success' && '✅'}{rec.type === 'warning' && '⚠️'}
                              {rec.type === 'danger' && '🚨'}{rec.type === 'info' && 'ℹ️'}
                            </span>
                            <span className="font-semibold flex-1">{rec.text}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              rec.type === 'success' ? 'bg-green-200 text-green-800' :
                              rec.type === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                              rec.type === 'danger' ? 'bg-red-200 text-red-800' :
                              'bg-blue-200 text-blue-800'
                            }`}>
                              {rec.type === 'danger' ? 'Aksiyon' : rec.type === 'warning' ? 'İzlem' : 'Bilgi'}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
