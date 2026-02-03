"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardData, RISK_COLORS, getRiskColor, useCohortTrajectory } from "@/hooks/useKimerizmData";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import type { RiskLevel } from "@/types";
import { normalizeGender } from "@/utils/formatters";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function Dashboard() {
  const { patients, kpis, riskDistribution, isLoading, error } = useDashboardData();
  const { data: cohortTrajectory } = useCohortTrajectory();
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel | null>(null);
  const [showAllPatients, setShowAllPatients] = useState(false);

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
        <div className="flex gap-3">
          <Link href="/model-evaluation">
            <Button variant="outline">🤖 Model Değerlendirmesi</Button>
          </Link>
        </div>
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
            <CardTitle className="text-sm font-medium">İyileşmiş Kohort</CardTitle>
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
          <TabsTrigger value="patients">Hasta Listesi</TabsTrigger>
          <TabsTrigger value="demographics">Demografik</TabsTrigger>
          <TabsTrigger value="cohort">Kohort Seyri (AI)</TabsTrigger>
          <TabsTrigger value="analytics">İleri Analitik</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
                        <div>KMR: {p.last_kmr?.toFixed(3) ?? '-'}%</div>
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

          {/* Recent Updates */}
          <div className="grid gap-6 md:grid-cols-2">
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
                      <p className="text-xs text-muted-foreground">{kpis.improvedCount} iyileşmiş kohort hastası</p>
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
                      {new Date(kpis.lastAnalysis).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hasta Listesi</CardTitle>
              <CardDescription>Tüm hastaların KMR, KRE, GFR ve risk durumu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(showAllPatients ? patients : patients.slice(0, 15)).map(p => (
                  <div key={p.patient_code} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getRiskColor(p.risk_level) }} />
                        <span className="font-medium">Hasta {p.patient_code}</span>
                        {p.improved_proxy && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">İyileşmiş</span>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {p.gender} • {p.age} yaş • {p.n_kmr_points} KMR, {p.n_kre_points} KRE, {p.n_gfr_points} GFR ölçüm
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">KMR</div>
                          <div className="font-medium">{p.last_kmr?.toFixed(3) ?? '-'}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">KRE</div>
                          <div className="font-medium">{p.last_kre?.toFixed(2) ?? '-'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">GFR</div>
                          <div className="font-medium">{p.last_gfr?.toFixed(0) ?? '-'}</div>
                        </div>
                      </div>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full text-white"
                          style={{ backgroundColor: getRiskColor(p.risk_level) }}>
                          {p.risk_level} ({p.risk_score.toFixed(0)})
                        </span>
                      </div>
                    </div>
                    <Link href={`/patients/${p.patient_code}`}>
                      <Button variant="outline" size="sm">Detay →</Button>
                    </Link>
                  </div>
                ))}
                
                {patients.length > 15 && (
                  <div className="text-center pt-4">
                    <Button variant="outline" onClick={() => setShowAllPatients(!showAllPatients)}>
                      {showAllPatients ? 'Daha Az Göster' : `Tümünü Gör (${patients.length} hasta)`}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
                      x: patients.filter(p => p.age && p.last_kmr).map(p => p.age),
                      y: patients.filter(p => p.age && p.last_kmr).map(p => p.last_kmr),
                      mode: 'markers',
                      type: 'scatter',
                      marker: {
                        size: 10,
                        color: patients.filter(p => p.age && p.last_kmr).map(p => 
                          normalizeGender(p.gender) === 'Erkek' ? '#3b82f6' : normalizeGender(p.gender) === 'Kadın' ? '#ec4899' : '#9ca3af'
                        ),
                        opacity: 0.7
                      },
                      text: patients.filter(p => p.age && p.last_kmr).map(p => p.patient_code),
                      hovertemplate: '<b>%{text}</b><br>Yaş: %{x}<br>KMR: %{y:.3f}%<extra></extra>'
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
          {cohortTrajectory ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">İyileşmiş Kohort</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">{cohortTrajectory.metadata.n_patients}</div>
                    <p className="text-xs text-green-600">9+ ay takipli hasta</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Başlangıç KMR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">{cohortTrajectory.summary.initial_kmr_median.toFixed(2)}%</div>
                    <p className="text-xs text-blue-600">Median Day_1</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Son KMR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-700">{cohortTrajectory.summary.final_kmr_median.toFixed(3)}%</div>
                    <p className="text-xs text-purple-600">Median Month_12</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam Düşüş</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-700">%{cohortTrajectory.summary.reduction_percent.toFixed(1)}</div>
                    <p className="text-xs text-orange-600">Stabil: {cohortTrajectory.summary.time_to_stable || '-'}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Main Trajectory Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>🧠 İyileşmiş Kohort KMR Seyri</CardTitle>
                  <CardDescription>
                    {cohortTrajectory.metadata.n_patients} hastanın <strong>LSTM + VAE (Variational Autoencoder)</strong> modelleri ile hesaplanan beklenen seyri
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
                          name: 'Gerçek Kohort Medyan',
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
                    <p>🟢 <strong>Gerçek Kohort Medyan:</strong> İyileşmiş hastaların gerçek medyan değerleri</p>
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
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Kohort trajectory verisi yükleniyor...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* KMR Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>KMR Değer Dağılımı</CardTitle>
                <CardDescription>Son kimerizm ölçümlerinin histogram dağılımı</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <Plot
                    data={[{
                      x: patients.map(p => p.last_kmr).filter(v => v !== null),
                      type: 'histogram',
                      nbinsx: 15,
                      marker: { color: '#3b82f6', opacity: 0.8 }
                    }]}
                    layout={{
                      xaxis: { title: 'Son KMR Değeri (%)' },
                      yaxis: { title: 'Hasta Sayısı' },
                      margin: { t: 20, b: 50, l: 50, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      shapes: [
                        { type: 'line', x0: 0.5, x1: 0.5, y0: 0, y1: 1, yref: 'paper', line: { color: '#f59e0b', width: 2, dash: 'dash' } },
                        { type: 'line', x0: 2.0, x1: 2.0, y0: 0, y1: 1, yref: 'paper', line: { color: '#ef4444', width: 2, dash: 'dash' } }
                      ]
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* KMR vs Risk Scatter */}
            <Card>
              <CardHeader>
                <CardTitle>KMR - Risk İlişkisi</CardTitle>
                <CardDescription>Son KMR değeri ile risk skoru korelasyonu</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <Plot
                    data={[{
                      x: patients.map(p => p.last_kmr).filter(v => v !== null),
                      y: patients.filter(p => p.last_kmr !== null).map(p => p.risk_score),
                      mode: 'markers',
                      type: 'scatter',
                      marker: {
                        size: 10,
                        color: patients.filter(p => p.last_kmr !== null).map(p => getRiskColor(p.risk_level)),
                        opacity: 0.7
                      },
                      text: patients.filter(p => p.last_kmr !== null).map(p => p.patient_code),
                      hovertemplate: '<b>Hasta %{text}</b><br>KMR: %{x:.3f}%<br>Risk: %{y:.1f}<extra></extra>'
                    }]}
                    layout={{
                      xaxis: { title: 'Son KMR (%)', type: 'log' },
                      yaxis: { title: 'Risk Skoru', range: [0, 100] },
                      margin: { t: 20, b: 50, l: 50, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)'
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* KRE vs GFR Scatter */}
            <Card>
              <CardHeader>
                <CardTitle>KRE - GFR İlişkisi</CardTitle>
                <CardDescription>Kreatinin ve GFR değerleri (renk = risk seviyesi)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <Plot
                    data={[{
                      x: patients.filter(p => p.last_kre && p.last_gfr).map(p => p.last_kre),
                      y: patients.filter(p => p.last_kre && p.last_gfr).map(p => p.last_gfr),
                      mode: 'markers',
                      type: 'scatter',
                      marker: {
                        size: 12,
                        color: patients.filter(p => p.last_kre && p.last_gfr).map(p => getRiskColor(p.risk_level)),
                        opacity: 0.7
                      },
                      text: patients.filter(p => p.last_kre && p.last_gfr).map(p => p.patient_code),
                      hovertemplate: '<b>Hasta %{text}</b><br>KRE: %{x:.2f}<br>GFR: %{y:.0f}<extra></extra>'
                    }]}
                    layout={{
                      xaxis: { title: 'Kreatinin (KRE)' },
                      yaxis: { title: 'GFR' },
                      margin: { t: 20, b: 50, l: 50, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      shapes: [
                        { type: 'line', x0: 1.2, x1: 1.2, y0: 0, y1: 150, line: { color: '#22c55e', width: 2, dash: 'dot' } },
                        { type: 'line', x0: 4.5, x1: 4.5, y0: 0, y1: 150, line: { color: '#ef4444', width: 2, dash: 'dot' } },
                        { type: 'line', x0: 0, x1: 6, y0: 90, y1: 90, line: { color: '#22c55e', width: 2, dash: 'dot' } },
                        { type: 'line', x0: 0, x1: 6, y0: 15, y1: 15, line: { color: '#ef4444', width: 2, dash: 'dot' } }
                      ]
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <p>KRE: &lt;1.2 iyi (yeşil çizgi), &gt;4.5 kötü (kırmızı çizgi)</p>
                  <p>GFR: &gt;90 iyi, &lt;15 kötü</p>
                </div>
              </CardContent>
            </Card>

            {/* Risk Component Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Bileşen Ağırlıkları</CardTitle>
                <CardDescription>Ensemble risk skorlama sistemi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <Plot
                    data={[{
                      x: ['KMR Seviye', 'KMR Trend', 'KMR Volatilite', 'KMR AE', 'KMR Residual', 'LAB'],
                      y: [35, 25, 10, 15, 15, 25],
                      type: 'bar',
                      marker: { 
                        color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']
                      },
                      text: ['35%', '25%', '10%', '15%', '15%', '25%'],
                      textposition: 'auto'
                    }]}
                    layout={{
                      xaxis: { title: 'Risk Bileşeni' },
                      yaxis: { title: 'Ağırlık (%)' },
                      margin: { t: 20, b: 80, l: 50, r: 20 },
                      paper_bgcolor: 'rgba(0,0,0,0)'
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Overall = 75% KMR Risk + 25% LAB Risk
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
