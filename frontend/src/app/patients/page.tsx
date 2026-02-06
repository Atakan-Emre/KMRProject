"use client";

import { useState } from "react";
import { useDashboardData, RISK_COLORS, getRiskColor } from "@/hooks/useKimerizmData";
import type { RiskLevel } from "@/types";
import { formatGender, formatVitalStatus, formatKMR, formatKRE, formatGFR, formatTimeKey } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Search, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";

function normalizeTurkishText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function PatientsPage() {
  const { patients, isLoading, error } = useDashboardData();
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("risk_desc");

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-lg font-medium">Veri yükleme hatası</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Bilinmeyen hata'}
          </p>
          <Button 
            className="mt-4" 
            onClick={() => window.location.reload()}
            variant="outline"
          >
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
          <p className="mt-2 text-sm text-muted-foreground">Hasta verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Filtreleme ve sıralama
  let filteredPatients = [...patients];
  
  // Arama filtresi
  if (searchTerm) {
    const normalizedSearch = normalizeTurkishText(searchTerm);
    filteredPatients = filteredPatients.filter(p => 
      normalizeTurkishText(p.patient_code).includes(normalizedSearch)
    );
  }
  
  // Risk filtresi
  if (riskFilter !== "all") {
    filteredPatients = filteredPatients.filter(p => p.risk_level === riskFilter);
  }
  
  // Sıralama
  filteredPatients.sort((a, b) => {
    switch (sortBy) {
      case "risk_desc":
        return b.risk_score - a.risk_score;
      case "risk_asc":
        return a.risk_score - b.risk_score;
      case "patient_asc":
        return a.patient_code.localeCompare(b.patient_code);
      case "patient_desc":
        return b.patient_code.localeCompare(a.patient_code);
      case "chr_desc":
        return (b.last_kmr ?? 0) - (a.last_kmr ?? 0);
      case "chr_asc":
        return (a.last_kmr ?? 0) - (b.last_kmr ?? 0);
      default:
        return 0;
    }
  });

  // Risk seviyesi istatistikleri
  const riskStats = {
    'Normal': patients.filter(p => p.risk_level === 'Normal').length,
    'Dikkat': patients.filter(p => p.risk_level === 'Dikkat').length,
    'Kritik': patients.filter(p => p.risk_level === 'Kritik').length,
    'Çok Kritik': patients.filter(p => p.risk_level === 'Çok Kritik').length,
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-2 sm:px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hasta Listesi</h1>
          <p className="text-muted-foreground">
            Tüm hastaların detaylı risk analizi ve takibi
          </p>
        </div>
      </div>

      {/* Risk İstatistikleri */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-2 sm:px-4 lg:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Object.entries(riskStats).map(([level, count]) => (
            <Card key={level}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{level}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: RISK_COLORS[level as RiskLevel] }}>
                  {count}
                </div>
                <p className="text-xs text-muted-foreground">
                  %{((count / patients.length) * 100).toFixed(1)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Filtreler */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-2 sm:px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtreler ve Arama</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Arama */}
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hasta kodu ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              {/* Risk Filtresi */}
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Risk seviyesi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Seviyeler</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Dikkat">Dikkat</SelectItem>
                  <SelectItem value="Kritik">Kritik</SelectItem>
                  <SelectItem value="Çok Kritik">Çok Kritik</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Sıralama */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sıralama" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="risk_desc">Risk (Yüksek → Düşük)</SelectItem>
                  <SelectItem value="risk_asc">Risk (Düşük → Yüksek)</SelectItem>
                  <SelectItem value="patient_asc">Hasta Kodu (A → Z)</SelectItem>
                  <SelectItem value="patient_desc">Hasta Kodu (Z → A)</SelectItem>
                  <SelectItem value="chr_desc">Kimerizm (Yüksek → Düşük)</SelectItem>
                  <SelectItem value="chr_asc">Kimerizm (Düşük → Yüksek)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hasta Tablosu */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-2 sm:px-4 lg:px-6">
        <Card className="w-full border bg-muted/20 shadow-sm">
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle>Hasta Verileri</CardTitle>
            <CardDescription>
              {filteredPatients.length} hasta gösteriliyor
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="rounded-xl bg-white/70 p-2">
              <div className="relative overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="text-[11px] text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th scope="col" className="px-3 py-2">Hasta Kodu</th>
                      <th scope="col" className="px-3 py-2">Cinsiyet</th>
                      <th scope="col" className="px-3 py-2">Durum</th>
                      <th scope="col" className="px-3 py-2">Risk Skoru</th>
                      <th scope="col" className="px-3 py-2">Risk Seviyesi</th>
                      <th scope="col" className="px-3 py-2">Son KMR</th>
                      <th scope="col" className="px-3 py-2">Son KRE</th>
                      <th scope="col" className="px-3 py-2">Son GFR</th>
                      <th scope="col" className="px-3 py-2">Trend</th>
                      <th scope="col" className="px-3 py-2">KMR Anomali</th>
                      <th scope="col" className="px-3 py-2">KRE Anomali</th>
                      <th scope="col" className="px-3 py-2">GFR Anomali</th>
                      <th scope="col" className="px-3 py-2">Ölçüm</th>
                      <th scope="col" className="px-3 py-2">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((patient) => {
                      const unresolvedAnyAnomaly =
                        patient.has_anomaly &&
                        !patient.kmr_has_anomaly &&
                        !patient.kre_has_anomaly &&
                        !patient.gfr_has_anomaly;
                      const kmrAnomaly = patient.kmr_has_anomaly || unresolvedAnyAnomaly;
                      const kreAnomaly = patient.kre_has_anomaly;
                      const gfrAnomaly = patient.gfr_has_anomaly;

                      return (
                      <tr key={patient.patient_code} className="bg-white border-b hover:bg-muted/50">
                    <th scope="row" className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {patient.patient_code}
                        {patient.improved_proxy && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ İyileşmiş
                          </span>
                        )}
                      </div>
                    </th>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${formatGender(patient.gender) === 'Erkek' ? 'bg-blue-100 text-blue-800' : formatGender(patient.gender) === 'Kadın' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-600'}`}>
                        {formatGender(patient.gender)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${formatVitalStatus(patient.vital_status) === 'Yaşıyor' ? 'bg-green-100 text-green-800' : formatVitalStatus(patient.vital_status) === 'Vefat' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                        {formatVitalStatus(patient.vital_status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center">
                        <div className="w-12 md:w-16 bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${patient.risk_score}%`, backgroundColor: getRiskColor(patient.risk_level) }} />
                        </div>
                        <span className="ml-2 text-xs sm:text-sm">{patient.risk_score.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: getRiskColor(patient.risk_level) }}>
                        {patient.risk_level}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {patient.last_kmr !== null && patient.last_kmr !== undefined ? (
                        <div className="flex flex-col">
                          <span>{formatKMR(patient.last_kmr)}</span>
                          {patient.last_kmr_time_key && (
                            <span className="text-xs text-muted-foreground">{formatTimeKey(patient.last_kmr_time_key)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {patient.last_kre !== null && patient.last_kre !== undefined ? (
                        <div className="flex flex-col">
                          <span>{formatKRE(patient.last_kre)}</span>
                          {patient.last_kre_time_key && (
                            <span className="text-xs text-muted-foreground">{formatTimeKey(patient.last_kre_time_key)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {patient.last_gfr !== null && patient.last_gfr !== undefined ? (
                        <div className="flex flex-col">
                          <span>{formatGFR(patient.last_gfr)}</span>
                          {patient.last_gfr_time_key && (
                            <span className="text-xs text-muted-foreground">{formatTimeKey(patient.last_gfr_time_key)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center">
                        {(patient.kmr_slope ?? 0) > 0 ? <TrendingUp className="h-4 w-4 text-red-500 mr-1" /> : <TrendingDown className="h-4 w-4 text-green-500 mr-1" />}
                        <span className="text-xs">{(patient.kmr_slope ?? 0) > 0 ? 'Yükseliş' : 'Düşüş'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                        kmrAnomaly
                          ? "bg-orange-100 text-orange-700 ring-orange-200"
                          : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      }`}>
                        {kmrAnomaly ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Var</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Yok</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                        kreAnomaly
                          ? "bg-orange-100 text-orange-700 ring-orange-200"
                          : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      }`}>
                        {kreAnomaly ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Var</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Yok</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                        gfrAnomaly
                          ? "bg-orange-100 text-orange-700 ring-orange-200"
                          : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      }`}>
                        {gfrAnomaly ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Var</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Yok</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">{patient.n_kmr_points}</td>
                    <td className="px-3 py-2">
                      <Link href={`/patients/${patient.patient_code}`}>
                        <Button variant="outline" size="sm">
                          Detay →
                        </Button>
                      </Link>
                    </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
            
            {filteredPatients.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchTerm || riskFilter !== "all" 
                    ? "Filtrelere uygun hasta bulunamadı." 
                    : "Henüz hasta verisi yok."}
                </p>
              </div>
              )}
            </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
