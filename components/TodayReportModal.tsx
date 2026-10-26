import { MotionPortal } from './ui/MotionPortal';
import { useAppMotion } from '../hooks/useAppMotion';
import { springs, motionTransition } from '../lib/motion';
import { AppIcon } from './ui/Icons';
import { localDateKey } from '../lib/dates';
import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DailyLog, CycleSettings } from '../types';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import Toast from './Toast';

interface TodayReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayLog: DailyLog | null;
  cycleSettings: CycleSettings;
  profile: { full_name?: string };
}

const TodayReportModal: React.FC<TodayReportModalProps> = ({
  isOpen,
  onClose,
  todayLog,
  cycleSettings,
  profile
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { reduced } = useAppMotion();
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'png' | 'pdf' | null>(null);
  const [toast, setToast] = useState<{ message: string; subMessage?: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const today = new Date();

  // Check if running in Capacitor
  // Check if running in Capacitor
  const isCapacitor = () => {
    return Capacitor.isNativePlatform();
  };

  const showToast = (message: string, subMessage?: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, subMessage, type, isVisible: true });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const flowText = (flow?: string) => {
    if (!flow) return 'Not logged';
    const flowMap: Record<string, string> = {
      'spotting': '🫧 Spotting',
      'light': '💧 Light Flow',
      'medium': '🩸 Medium Flow',
      'heavy': '🩸🩸 Heavy Flow'
    };
    return flowMap[flow] || flow;
  };

  const saveFileMobile = async (fileName: string, dataBase64: string, mimeType: string) => {
    try {
      // Try Downloads folder first
      await Filesystem.writeFile({
        path: `Download/${fileName}`,
        data: dataBase64,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      showToast('Report Saved!', `File saved to Downloads/${fileName}`);
    } catch (e) {
      console.log('Download folder access failed, trying Documents', e);
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: dataBase64,
          directory: Directory.Documents,
        });
        showToast('Report Saved!', `File saved to Documents/${fileName}`);
      } catch (e2) {
        console.log('Documents folder access failed, using Share', e2);
        // Fallback to Share sheet
        const result = await Filesystem.writeFile({
            path: fileName,
            data: dataBase64,
            directory: Directory.Cache,
        });

        await Share.share({
            title: fileName,
            text: 'Here is my daily health report from Twilight Garden',
            url: result.uri,
            dialogTitle: 'Share Report',
        });
      }
    }
  };

  const exportAsPNG = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportType('png');

    // Small delay to ensure card renders
    await new Promise(r => setTimeout(r, 100));

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true
      });

      const fileName = `Twilight_Today_${localDateKey(today)}.png`;
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];

      if (isCapacitor()) {
        await saveFileMobile(fileName, base64Data, 'image/png');
      } else {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
        showToast('Report Downloaded!', 'Image saved to your device');
      }

      setTimeout(onClose, 2000);
    } catch (error) {
      console.error('Failed to export PNG:', error);
      showToast('Export Failed', 'Could not generate image', 'error');
    }

    setIsExporting(false);
    setExportType(null);
  };

  const exportAsPDF = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportType('pdf');

    await new Promise(r => setTimeout(r, 100));

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const scale = (pdfWidth - 40) / imgWidth;
      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      const x = (pdfWidth - scaledWidth) / 2;
      const y = 30;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(152, 67, 105);
      pdf.text('Daily Health Report', pdfWidth / 2, 20, { align: 'center' });

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by Twilight Garden', pdfWidth / 2, pdfHeight - 10, { align: 'center' });

      const fileName = `Twilight_Today_${localDateKey(today)}.pdf`;

      if (isCapacitor()) {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        await saveFileMobile(fileName, pdfBase64, 'application/pdf');
      } else {
        pdf.save(fileName);
        showToast('Report Downloaded!', 'PDF saved to your device');
      }

      setTimeout(onClose, 2000);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      showToast('Export Failed', 'Could not generate PDF', 'error');
    }

    setIsExporting(false);
    setExportType(null);
  };

  return (
    <AnimatePresence>
      {/* Global Toast */}
      <Toast
        message={toast.message}
        subMessage={toast.subMessage}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      <AppIcon name={isOpen && (
        <MotionPortal><motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          {/* Simple Format Selection Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={motionTransition(springs.modal, reduced)}
            className="bg-white dark:bg-surface-dark rounded-2xl p-6 max-w-xs w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
              Export Today's Report
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Choose your preferred format
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={exportAsPNG}
                disabled={isExporting}
                className="on-brand flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                <span className="app-icon-glyph"><AppIcon name={"image"}/></span>
                {exportType === 'png' ? 'Generating...' : 'PNG Image'}
              </button>

              <button
                onClick={exportAsPDF}
                disabled={isExporting}
                className="on-brand flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                <span className="app-icon-glyph"><AppIcon name={"picture_as_pdf"}/></span>
                {exportType === 'pdf' ? 'Generating...' : 'PDF Document'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-4 py-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </motion.div>

          {/* Hidden Card for Export - Not visible */}
          <div className="fixed -left-[9999px] top-0">
            <div
              ref={cardRef}
              className="rounded-2xl p-6 w-[360px] relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #984369 0%, #BE123C 50%, #7C3AED 100%)'
              }}
            >
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full" style={{ transform: 'translate(50%, -50%)' }}></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full" style={{ transform: 'translate(-50%, 50%)' }}></div>

              {/* Content */}
              <div className="relative z-10 text-center">
                <div className="mb-6">
                  <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">
                    {formatDate(today)}
                  </p>
                  <h3 className="text-white text-2xl font-bold leading-tight">
                    {profile.full_name?.split(' ')[0] || 'My'}'s Daily Report
                  </h3>
                </div>

                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-5 mb-4 text-center">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-2">Flow</p>
                  <p className="text-white text-xl font-bold">
                    {flowText(todayLog?.flow)}
                  </p>
                </div>

                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-5 mb-4 text-center">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Symptoms</p>
                  {todayLog?.symptoms && todayLog.symptoms.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {todayLog.symptoms.map((symptom, i) => {
                        const symptomEmojis: Record<string, string> = {
                          cramps: '😖', 'tender breasts': '🍈', headache: '🤕', acne: '🎭',
                          backache: '🧘', fatigue: '🥱', bloating: '🎈', insomnia: '👁️',
                          nausea: '🤢', dizziness: '😵', 'hot flashes': '🚒', chills: '🥶',
                          'pelvic pain': '⚡', 'joint pain': '🦴', 'sensory sensitivity': '🎧'
                        };
                        return (
                          <span
                            key={i}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-white/20 rounded-full text-white text-sm font-semibold backdrop-blur-md"
                          >
                            <span>{symptomEmojis[symptom.toLowerCase()] || '🩺'}</span>
                            {symptom}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-white/80 text-sm">No symptoms logged</p>
                  )}
                </div>

                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-5 mb-4 text-center">
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-3">Mood</p>
                  {todayLog?.moods && todayLog.moods.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {todayLog.moods.map((mood, i) => {
                        const moodEmojis: Record<string, string> = {
                          calm: '😌', happy: '😊', energetic: '🤩', frisky: '🥰',
                          swings: '🎢', anxious: '😰', sad: '😢', irritated: '😠'
                        };
                        return (
                          <span
                            key={i}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-white/20 rounded-full text-white text-sm font-semibold backdrop-blur-md capitalize"
                          >
                            <span>{moodEmojis[mood.toLowerCase()] || '🙂'}</span>
                            {mood}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-white/80 text-sm">No mood logged</p>
                  )}
                </div>

                {todayLog?.notes && (
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-5 mb-4 text-center">
                    <p className="text-white/70 text-xs uppercase tracking-wider mb-2">Notes</p>
                    <p className="text-white text-sm leading-relaxed">{todayLog.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-white/70 text-xs">Cycle Day</p>
                    <p className="text-white text-2xl font-bold">
                      {cycleSettings.lastPeriodStart && cycleSettings.avgCycleLength > 0
                        ? Math.max(1, Math.floor((today.getTime() - new Date(cycleSettings.lastPeriodStart).getTime()) / (1000 * 60 * 60 * 24)) % cycleSettings.avgCycleLength + 1)
                        : '-'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-xs">Twilight Garden</p>
                    <p className="text-white/30 text-[10px]">Your Health Companion</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div></MotionPortal>
      )}/>
    </AnimatePresence>
  );
};

export default TodayReportModal;
