import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyLog } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface LogDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: DailyLog | null;
  date: string;
  readOnly?: boolean;
}

const LogDetailsModal: React.FC<LogDetailsModalProps> = ({ isOpen, onClose, log, date, readOnly = false }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-background-dark dark:bg-surface-dark rounded-[32px] overflow-hidden shadow-2xl border border-gray-100 dark:border-white/10 relative"
            >
              {/* Header Image/Gradient */}
              <div className="h-24 bg-gradient-to-br from-primary/20 via-purple-500/10 to-teal-500/10 relative">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-white hover:bg-black/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 pb-6 -mt-10 relative">
                {/* Date Badge */}
                <div className="inline-flex items-center gap-2 bg-white dark:bg-surface-dark px-4 py-2 rounded-full shadow-sm mb-4 border border-gray-100 dark:border-white/5">
                  <span className="material-symbols-outlined text-primary text-sm">calendar_today</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{formatDate(date)}</span>
                </div>

                {!log ? (
                  <div className="text-center py-6">
                    <p className="text-gray-500">No details logged for this day.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* Flow */}
                    {log.flow && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Flow</h4>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-gray-800 dark:text-gray-200 capitalize font-medium">{log.flow}</span>
                        </div>
                      </div>
                    )}

                    {/* Moods */}
                    {log.moods && log.moods.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mood</h4>
                        <div className="flex flex-wrap gap-2">
                          {log.moods.map(mood => (
                            <span key={mood} className="px-3 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-lg text-sm font-medium capitalize">
                              {mood}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Symptoms */}
                    {log.symptoms && log.symptoms.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Symptoms</h4>
                        <div className="flex flex-wrap gap-2">
                          {log.symptoms.map(sym => (
                            <span key={sym} className="px-3 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium capitalize">
                              {sym}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Energy & Sleep */}
                    {(log.energyLevel || log.sleepQuality) && (
                      <div className="flex gap-4">
                        {log.energyLevel && (
                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Energy</h4>
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-yellow-500 text-sm">bolt</span>
                              <span className="text-gray-800 dark:text-gray-200 capitalize font-medium">{log.energyLevel}</span>
                            </div>
                          </div>
                        )}
                        {log.sleepQuality && (
                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sleep</h4>
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-indigo-500 text-sm">bedtime</span>
                              <div className="flex flex-col">
                                <span className="text-gray-800 dark:text-gray-200 capitalize font-medium">{log.sleepQuality}</span>
                                {log.sleepHours !== undefined && (
                                  <span className="text-[10px] text-indigo-500/70 font-bold">{log.sleepHours}h duration</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {log.notes && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</h4>
                        <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl">
                          <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{log.notes}"</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit Button - Hidden in Read Only Mode */}
                {!readOnly && (
                  <button
                    onClick={() => {
                      navigate(`/log/details?date=${date}`);
                      onClose();
                    }}
                    className="on-brand w-full mt-6 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                    Edit Log
                  </button>
                )}

              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LogDetailsModal;
