import { localDateKey } from './dates';
import { jsPDF } from 'jspdf';
import { DailyLog, CycleSettings } from '../types';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

interface ExportData {
  profile: {
    full_name: string;
    email: string;
  };
  cycleSettings: CycleSettings;
  logs: DailyLog[];
}

// Check if running in Capacitor
const isCapacitor = () => {
  return Capacitor.isNativePlatform();
};

// Save PDF directly to Downloads folder for mobile
const savePDFMobile = async (doc: jsPDF, fileName: string): Promise<void> => {
  const dataUri = doc.output('datauristring');
  const commaIdx = dataUri.indexOf(',');
  const pdfBase64 = commaIdx >= 0 ? dataUri.substring(commaIdx + 1) : dataUri;

  try {
    // Save directly to Documents/Downloads directory
    await Filesystem.writeFile({
      path: `Download/${fileName}`,
      data: pdfBase64,
      directory: Directory.ExternalStorage,
      recursive: true,
    });
    // Return success to let caller handle UI
    return;
  } catch (error) {
    console.error('Error saving to Downloads, trying Documents:', error);

    // Fallback: try Documents directory
    try {
      await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Documents,
      });
      return;
    } catch (fallbackError) {
      console.error('Error saving to Documents:', fallbackError);

      // Last fallback: Use share sheet
      const result = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: fileName,
        text: 'Your Twilight Garden Health Report',
        url: result.uri,
        dialogTitle: 'Save your report',
      });
    }
  }
};

// Colors matching the app theme
const COLORS = {
  primary: '#984369',
  primaryLight: '#F8E8EE',
  dark: '#121014',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
};

export async function exportHealthDataToPDF(data: ExportData): Promise<void> {
  const { profile, cycleSettings, logs } = data;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  // Helper functions
  const addNewPageIfNeeded = (requiredSpace: number = 40) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  const drawLine = (y: number) => {
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // ============== HEADER ==============
  // Background gradient effect (solid for PDF)
  doc.setFillColor(152, 67, 105); // Primary color
  doc.rect(0, 0, pageWidth, 55, 'F');

  // App title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('Twilight Garden', margin, 25);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('Health & Wellness Report', margin, 35);

  // Date
  const today = new Date();
  doc.setFontSize(10);
  doc.text(`Generated: ${today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 48);

  yPos = 70;

  // ============== USER INFO ==============
  doc.setFillColor(248, 232, 238); // Light pink
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 5, 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(152, 67, 105);
  doc.text(profile.full_name || 'User', margin + 10, yPos + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(profile.email || '', margin + 10, yPos + 27);

  yPos += 50;

  // ============== CYCLE SUMMARY ==============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(18, 16, 20);
  doc.text('Cycle Summary', margin, yPos);
  yPos += 15;

  // Summary cards
  const cardWidth = (pageWidth - 2 * margin - 10) / 2;

  // Card 1: Cycle Length
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, yPos, cardWidth, 40, 5, 5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('Average Cycle', margin + 10, yPos + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(152, 67, 105);
  doc.text(`${cycleSettings.avgCycleLength} days`, margin + 10, yPos + 32);

  // Card 2: Period Length
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + cardWidth + 10, yPos, cardWidth, 40, 5, 5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('Average Period', margin + cardWidth + 20, yPos + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(152, 67, 105);
  doc.text(`${cycleSettings.avgPeriodLength} days`, margin + cardWidth + 20, yPos + 32);

  yPos += 55;

  // Last Period
  if (cycleSettings.lastPeriodStart) {
    const lastDate = new Date(cycleSettings.lastPeriodStart);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`Last Period Started: ${lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPos);
    yPos += 15;
  }

  drawLine(yPos);
  yPos += 15;

  // ============== LOG HISTORY ==============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(18, 16, 20);
  doc.text('Log History', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`${logs.length} entries`, margin + 70, yPos);
  yPos += 15;

  // Sort logs by date (newest first)
  const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Table Header
  doc.setFillColor(248, 232, 238);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(152, 67, 105);
  doc.text('Date', margin + 5, yPos + 7);
  doc.text('Flow', margin + 40, yPos + 7);
  doc.text('Moods', margin + 65, yPos + 7);
  doc.text('Symptoms', margin + 105, yPos + 7);
  yPos += 12;

  // Flow level to text
  const flowText = (flow: string | undefined) => {
    if (!flow) return '-';
    const flowMap: Record<string, string> = {
      'spotting': 'Spotting',
      'light': 'Light',
      'medium': 'Medium',
      'heavy': 'Heavy'
    };
    return flowMap[flow] || flow;
  };

  // Log rows
  for (const log of sortedLogs.slice(0, 30)) { // Limit to 30 entries
    addNewPageIfNeeded(15);

    const logDate = new Date(log.date);
    const dateStr = logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(18, 16, 20);
    doc.text(dateStr, margin + 5, yPos + 5);

    doc.setTextColor(152, 67, 105);
    doc.text(flowText(log.flow), margin + 40, yPos + 5);

    doc.setTextColor(107, 114, 128);
    const moodsStr = log.moods?.slice(0, 2).join(', ') || '-';
    doc.text(moodsStr, margin + 65, yPos + 5);

    const symptomsStr = log.symptoms?.slice(0, 2).join(', ') || '-';
    doc.text(symptomsStr, margin + 105, yPos + 5);

    yPos += 10;

    // Light row separator
    doc.setDrawColor(245, 245, 245);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  }

  if (sortedLogs.length > 30) {
    yPos += 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`... and ${sortedLogs.length - 30} more entries`, margin, yPos);
  }

  // ============== FOOTER ==============
  const footerY = pageHeight - 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text('Generated by Twilight Garden • Your personal health companion', pageWidth / 2, footerY, { align: 'center' });

  // Add footer to all pages
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
  }

  // Save the PDF
  const fileName = `Twilight_Health_Report_${localDateKey(today)}.pdf`;

  if (isCapacitor()) {
    await savePDFMobile(doc, fileName);
  } else {
    doc.save(fileName);
  }
}

// =========================================================
// DOCTOR'S REPORT - Professional Medical Summary
// =========================================================
export async function exportDoctorsReport(data: ExportData): Promise<void> {
  const { profile, cycleSettings, logs } = data;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;
  const today = new Date();

  // Helper to add new page
  const addNewPageIfNeeded = (space: number = 30) => {
    if (yPos + space > pageHeight - 25) {
      doc.addPage();
      yPos = 25;
      return true;
    }
    return false;
  };

  // ============== PROFESSIONAL HEADER ==============
  // Blue medical theme instead of pink
  doc.setFillColor(37, 99, 235); // Medical blue
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Menstrual Health Report', margin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('For Healthcare Provider Review', margin, 32);

  // Date in header
  doc.setFontSize(9);
  doc.text(`Report Date: ${today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin, 22, { align: 'right' });

  yPos = 55;

  // ============== PATIENT INFORMATION ==============
  doc.setFillColor(243, 244, 246); // Light gray
  doc.rect(margin, yPos, pageWidth - 2 * margin, 30, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('PATIENT INFORMATION', margin + 5, yPos + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(`Name: ${profile.full_name || 'Not Provided'}`, margin + 5, yPos + 18);
  doc.text(`Contact: ${profile.email || 'Not Provided'}`, margin + 90, yPos + 18);
  doc.text(`Report Period: Last 90 days`, margin + 5, yPos + 26);

  yPos += 40;

  // ============== CYCLE OVERVIEW ==============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);
  doc.text('CYCLE OVERVIEW', margin, yPos);
  yPos += 10;

  // Draw box
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'S');

  // Stats
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);

  const col1 = margin + 10;
  const col2 = margin + 65;
  const col3 = margin + 120;

  doc.text('Average Cycle Length:', col1, yPos + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(`${cycleSettings.avgCycleLength} days`, col1, yPos + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Average Period Length:', col2, yPos + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(`${cycleSettings.avgPeriodLength} days`, col2, yPos + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Cycle Regularity:', col3, yPos + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(cycleSettings.irregularCycle ? 192 : 34, cycleSettings.irregularCycle ? 38 : 197, cycleSettings.irregularCycle ? 38 : 94);
  doc.text(cycleSettings.irregularCycle ? 'Irregular' : 'Regular', col3, yPos + 20);

  if (cycleSettings.lastPeriodStart) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    const lastDate = new Date(cycleSettings.lastPeriodStart);
    doc.text(`Last Period Start: ${lastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, col1, yPos + 30);
  }

  yPos += 45;

  // ============== SYMPTOM ANALYSIS ==============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);
  doc.text('SYMPTOM ANALYSIS (Last 90 Days)', margin, yPos);
  yPos += 10;

  // Analyze symptoms from logs
  const symptomCounts: Record<string, number> = {};
  const moodCounts: Record<string, number> = {};
  const flowCounts: Record<string, number> = {};

  const last90Days = new Date();
  last90Days.setDate(last90Days.getDate() - 90);

  const recentLogs = logs.filter(l => new Date(l.date) >= last90Days);

  recentLogs.forEach(log => {
    if (log.symptoms) {
      log.symptoms.forEach(s => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    }
    if (log.moods) {
      log.moods.forEach(m => {
        moodCounts[m] = (moodCounts[m] || 0) + 1;
      });
    }
    if (log.flow) {
      flowCounts[log.flow] = (flowCounts[log.flow] || 0) + 1;
    }
  });

  // Top symptoms
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topMoods = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  doc.setDrawColor(229, 231, 235);
  doc.rect(margin, yPos, (pageWidth - 2 * margin - 5) / 2, 55, 'S');
  doc.rect(margin + (pageWidth - 2 * margin + 5) / 2, yPos, (pageWidth - 2 * margin - 5) / 2, 55, 'S');

  // Symptoms column
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text('Most Reported Symptoms', margin + 5, yPos + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  if (topSymptoms.length === 0) {
    doc.text('No symptoms recorded', margin + 5, yPos + 20);
  } else {
    topSymptoms.forEach(([symptom, count], i) => {
      doc.text(`• ${symptom} (${count}x)`, margin + 5, yPos + 18 + i * 8);
    });
  }

  // Moods column
  const col2Start = margin + (pageWidth - 2 * margin + 5) / 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Most Reported Moods', col2Start + 5, yPos + 8);

  doc.setFont('helvetica', 'normal');
  if (topMoods.length === 0) {
    doc.text('No moods recorded', col2Start + 5, yPos + 20);
  } else {
    topMoods.forEach(([mood, count], i) => {
      doc.text(`• ${mood} (${count}x)`, col2Start + 5, yPos + 18 + i * 8);
    });
  }

  yPos += 65;

  // ============== RECENT LOG ENTRIES ==============
  addNewPageIfNeeded(60);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);
  doc.text('RECENT LOG ENTRIES', margin, yPos);
  yPos += 8;

  // Table header
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text('Date', margin + 3, yPos + 6);
  doc.text('Flow', margin + 30, yPos + 6);
  doc.text('Symptoms', margin + 55, yPos + 6);
  doc.text('Moods', margin + 120, yPos + 6);
  yPos += 10;

  // Sort and display logs
  const sortedLogs = [...recentLogs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  for (const log of sortedLogs) {
    addNewPageIfNeeded(10);

    const logDate = new Date(log.date);
    doc.setTextColor(75, 85, 99);
    doc.text(logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), margin + 3, yPos + 4);
    doc.text(log.flow || '-', margin + 30, yPos + 4);
    doc.text((log.symptoms?.slice(0, 2).join(', ') || '-').substring(0, 30), margin + 55, yPos + 4);
    doc.text((log.moods?.slice(0, 2).join(', ') || '-').substring(0, 25), margin + 120, yPos + 4);

    yPos += 7;
    doc.setDrawColor(243, 244, 246);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  }

  yPos += 15;

  // ============== DISCLAIMER ==============
  addNewPageIfNeeded(40);

  doc.setFillColor(254, 243, 199); // Yellow warning
  doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(161, 98, 7);
  doc.text('DISCLAIMER', margin + 5, yPos + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('This report is generated from self-reported data in the Twilight Garden app. It is intended for', margin + 5, yPos + 15);
  doc.text('informational purposes only and should not replace professional medical advice or diagnosis.', margin + 5, yPos + 20);

  // ============== FOOTER ==============
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('Generated by Twilight Garden Health App', margin, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  // Save
  const fileName = `Doctors_Report_${localDateKey(today)}.pdf`;

  if (isCapacitor()) {
    await savePDFMobile(doc, fileName);
  } else {
    doc.save(fileName);
  }
}
