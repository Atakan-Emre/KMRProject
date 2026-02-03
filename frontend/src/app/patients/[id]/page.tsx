// Server Component wrapper for static export
// Mevcut client component'i import eder ve generateStaticParams sağlar

import PatientDetailClient from "./PatientDetailClient";
import fs from "fs";
import path from "path";

// Static export için hasta ID'lerini dinamik olarak JSON dosyalarından çek
export async function generateStaticParams() {
  // public/patients klasöründeki tüm .json dosyalarını oku
  const patientsDir = path.join(process.cwd(), "public", "patients");
  
  try {
    const files = fs.readdirSync(patientsDir);
    
    // .json uzantılı dosyaların adlarından ID'leri çıkar
    const patientIds = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(".json", ""));
    
    return patientIds.map((id) => ({
      id: id,
    }));
  } catch (error) {
    console.error("Hasta dosyaları okunamadı:", error);
    return [];
  }
}

// Page component - client component'i render eder
export default function PatientDetailPage() {
  return <PatientDetailClient />;
}
