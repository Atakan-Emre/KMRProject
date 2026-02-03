"use client";

import { useState } from "react";
import { useDashboardData } from "@/hooks/useKimerizmData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGender, formatVitalStatus, formatKMR, formatKRE, formatGFR, formatNumber, formatTrend } from "@/utils/formatters";
import Link from "next/link";
import { Download, FileSpreadsheet, FileText, ArrowLeft } from "lucide-react";

export default function ReportsPage() {
  const { patients, isLoading, error } = useDashboardData();
  const [selectedPatient, setSelectedPatient] = useState<string>("all");
  const [reportType, setReportType] = useState<"summary" | "detailed">("summary");

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

  const selectedPatientData = selectedPatient !== "all" 
    ? patients.find(p => p.patient_code === selectedPatient) 
    : null;

  const generateFileName = (extension: string) => {
    const date = new Date().toISOString().split('T')[0];
    if (selectedPatient === "all") {
      return `Rapor_TumHastalar_${date}.${extension}`;
    }
    return `Rapor_${selectedPatient}_${date}.${extension}`;
  };

  const downloadExcel = () => {
    const data = selectedPatient === "all" ? patients : patients.filter(p => p.patient_code === selectedPatient);
    
    // CSV formatında Excel uyumlu dosya oluştur
    const headers = [
      "Hasta Kodu", "Cinsiyet", "Yaş", "Durum", "Son KMR (%)", "Son KRE", "Son GFR",
      "KMR Trend", "Risk Skoru", "Risk Seviyesi", "Anomali", "Ölçüm Sayısı"
    ];
    
    const rows = data.map(p => [
      p.patient_code,
      formatGender(p.gender),
      p.age ?? "-",
      formatVitalStatus(p.vital_status),
      formatNumber(p.last_kmr, 4),
      formatNumber(p.last_kre, 2),
      formatNumber(p.last_gfr, 0),
      formatTrend(p.kmr_slope).text,
      formatNumber(p.risk_score, 1),
      p.risk_level,
      p.has_anomaly ? "Var" : "Yok",
      p.n_kmr_points
    ]);

    // BOM ekleyerek UTF-8 desteği
    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = generateFileName("csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    // PDF için basit HTML rapor oluştur ve yazdır
    const data = selectedPatient === "all" ? patients : patients.filter(p => p.patient_code === selectedPatient);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Kimerizm Raporu - ${generateFileName("pdf")}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
          h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 20px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .risk-normal { color: #22c55e; }
          .risk-dikkat { color: #f59e0b; }
          .risk-kritik { color: #f97316; }
          .risk-cok-kritik { color: #ef4444; }
          .header-info { margin-bottom: 20px; color: #6b7280; }
          .summary-box { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>🏥 Kimerizm Takip Sistemi - Hasta Raporu</h1>
        <div class="header-info">
          <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}</p>
          <p><strong>Rapor Tipi:</strong> ${selectedPatient === "all" ? "Tüm Hastalar" : `Hasta: ${selectedPatient}`}</p>
          <p><strong>Toplam Hasta:</strong> ${data.length}</p>
        </div>
        
        ${selectedPatientData ? `
        <div class="summary-box">
          <h2>📊 Hasta Özeti: ${selectedPatientData.patient_code}</h2>
          <p><strong>Cinsiyet:</strong> ${formatGender(selectedPatientData.gender)} | <strong>Yaş:</strong> ${selectedPatientData.age ?? "-"} | <strong>Durum:</strong> ${formatVitalStatus(selectedPatientData.vital_status)}</p>
          <p><strong>Son KMR:</strong> ${formatKMR(selectedPatientData.last_kmr)} | <strong>Son KRE:</strong> ${formatKRE(selectedPatientData.last_kre)} | <strong>Son GFR:</strong> ${formatGFR(selectedPatientData.last_gfr)}</p>
          <p><strong>Risk Skoru:</strong> ${formatNumber(selectedPatientData.risk_score, 1)} | <strong>Risk Seviyesi:</strong> ${selectedPatientData.risk_level}</p>
          <p><strong>KMR Trend:</strong> ${formatTrend(selectedPatientData.kmr_slope).text} | <strong>Anomali:</strong> ${selectedPatientData.has_anomaly ? "Var" : "Yok"}</p>
        </div>
        ` : ""}
        
        <h2>📋 Hasta Listesi</h2>
        <table>
          <thead>
            <tr>
              <th>Hasta Kodu</th>
              <th>Cinsiyet</th>
              <th>Yaş</th>
              <th>Durum</th>
              <th>Son KMR</th>
              <th>Son KRE</th>
              <th>Son GFR</th>
              <th>Risk</th>
              <th>Seviye</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(p => `
              <tr>
                <td><strong>${p.patient_code}</strong></td>
                <td>${formatGender(p.gender)}</td>
                <td>${p.age ?? "-"}</td>
                <td>${formatVitalStatus(p.vital_status)}</td>
                <td>${formatKMR(p.last_kmr)}</td>
                <td>${formatKRE(p.last_kre)}</td>
                <td>${formatGFR(p.last_gfr)}</td>
                <td>${formatNumber(p.risk_score, 1)}</td>
                <td class="risk-${p.risk_level.toLowerCase().replace(' ', '-').replace('ç', 'c').replace('ö', 'o')}">${p.risk_level}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 10px;">
          <p>Bu rapor Kimerizm Takip Sistemi v3.0 tarafından otomatik olarak oluşturulmuştur.</p>
          <p>⚠️ Bu sistem karar destek amaçlıdır. Klinik kararlar uzman hekim değerlendirmesi ile alınmalıdır.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📄 Raporlar</h1>
          <p className="text-muted-foreground">
            Hasta verilerini Excel veya PDF olarak indirin
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ana Sayfaya Dön
          </Button>
        </Link>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <CardTitle>Rapor Ayarları</CardTitle>
          <CardDescription>İndirmek istediğiniz raporu yapılandırın</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Hasta Seçimi</label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Hasta seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Hastalar ({patients.length})</SelectItem>
                  {patients.map(p => (
                    <SelectItem key={p.patient_code} value={p.patient_code}>
                      {p.patient_code} - {p.risk_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Rapor Tipi</label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as "summary" | "detailed")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Özet Rapor</SelectItem>
                  <SelectItem value="detailed">Detaylı Rapor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={downloadExcel} className="flex-1">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel İndir
              </Button>
              <Button onClick={downloadPDF} variant="outline" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                PDF İndir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Önizleme */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Rapor Önizleme</CardTitle>
          <CardDescription>
            {selectedPatient === "all" 
              ? `${patients.length} hasta listelenecek`
              : `Hasta ${selectedPatient} bilgileri`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedPatientData ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Hasta Bilgileri</p>
                <p className="text-lg font-bold text-blue-800">{selectedPatientData.patient_code}</p>
                <p className="text-sm text-blue-600">{formatGender(selectedPatientData.gender)} • {selectedPatientData.age ?? "-"} yaş</p>
                <p className="text-sm text-blue-600">{formatVitalStatus(selectedPatientData.vital_status)}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Son KMR</p>
                <p className="text-lg font-bold text-purple-800">{formatKMR(selectedPatientData.last_kmr)}</p>
                <p className="text-sm text-purple-600">Trend: {formatTrend(selectedPatientData.kmr_slope).text}</p>
              </div>
              <div className="p-4 bg-cyan-50 rounded-lg">
                <p className="text-sm text-cyan-600 font-medium">Böbrek Fonksiyonu</p>
                <p className="text-lg font-bold text-cyan-800">KRE: {formatKRE(selectedPatientData.last_kre)}</p>
                <p className="text-sm text-cyan-600">GFR: {formatGFR(selectedPatientData.last_gfr)}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-600 font-medium">Risk Durumu</p>
                <p className="text-lg font-bold text-orange-800">{formatNumber(selectedPatientData.risk_score, 1)}</p>
                <p className="text-sm text-orange-600">{selectedPatientData.risk_level}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left">Hasta</th>
                    <th className="px-4 py-2 text-left">Cinsiyet</th>
                    <th className="px-4 py-2 text-left">Durum</th>
                    <th className="px-4 py-2 text-left">Son KMR</th>
                    <th className="px-4 py-2 text-left">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.slice(0, 10).map(p => (
                    <tr key={p.patient_code} className="border-b">
                      <td className="px-4 py-2 font-medium">{p.patient_code}</td>
                      <td className="px-4 py-2">{formatGender(p.gender)}</td>
                      <td className="px-4 py-2">{formatVitalStatus(p.vital_status)}</td>
                      <td className="px-4 py-2">{formatKMR(p.last_kmr)}</td>
                      <td className="px-4 py-2">{p.risk_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {patients.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  ... ve {patients.length - 10} hasta daha
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* İndirme Bilgisi */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">İndirme Formatları</p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li><strong>Excel (CSV):</strong> Tüm hasta verilerini tablo formatında içerir. Excel, Google Sheets ile açılabilir.</li>
                <li><strong>PDF:</strong> Yazdırılabilir rapor formatı. Tarayıcının yazdırma özelliği ile PDF olarak kaydedilebilir.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
