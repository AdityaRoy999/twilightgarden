import { MotionPortal } from '../components/ui/MotionPortal';
import { AppIcon } from '../components/ui/Icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { motion, AnimatePresence } from 'framer-motion';

const getMoodEmoji = (mood: string) => {
  const m = mood.toLowerCase();
  if (m.includes('happy') || m.includes('great')) return '😊';
  if (m.includes('energetic') || m.includes('productive')) return '🤩';
  if (m.includes('sad') || m.includes('down')) return '😔';
  if (m.includes('anxious') || m.includes('stressed')) return '😰';
  if (m.includes('irritated') || m.includes('angry')) return '😠';
  if (m.includes('calm') || m.includes('relaxed')) return '😌';
  return '😐';
};

const LogHistory: React.FC = () => {
  const navigate = useNavigate();
  const { logs } = useData();
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list');
  const [selectedLog, setSelectedLog] = React.useState<any | null>(null);

  // Sort logs by date descending (newest first)
  const sortedLogs = React.useMemo(() => 
    [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [logs]
  );

  return (
    <div className="animate-slideIn font-display flex flex-col min-h-screen bg-background-dark pb-6">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-background-dark/95 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span className="app-icon-glyph text-2xl"><AppIcon name={"arrow_back"}/></span>
        </button>
        <h2 className="text-[17px] font-bold text-white tracking-tight">Log History</h2>
        
        {/* View Toggle */}
        <div className="relative flex bg-surface-dark p-1 rounded-xl border border-white/5 w-[84px]">
            <button 
                onClick={() => setViewMode('list')}
                className={`relative z-10 flex-1 flex items-center justify-center p-1.5 rounded-lg transition-colors duration-200 ${viewMode === 'list' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            >
                {viewMode === 'list' && (
                  <motion.div
                    layoutId="logHistoryViewToggle"
                    className="absolute inset-0 bg-white/10 rounded-lg shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="app-icon-glyph text-[20px] relative z-20"><AppIcon name={"view_list"}/></span>
            </button>
            <button 
                onClick={() => setViewMode('grid')}
                className={`relative z-10 flex-1 flex items-center justify-center p-1.5 rounded-lg transition-colors duration-200 ${viewMode === 'grid' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            >
                {viewMode === 'grid' && (
                  <motion.div
                    layoutId="logHistoryViewToggle"
                    className="absolute inset-0 bg-white/10 rounded-lg shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="app-icon-glyph text-[20px] relative z-20"><AppIcon name={"grid_view"}/></span>
            </button>
        </div>
      </header>

       <main className="flex-1 px-5 pb-6">
        {sortedLogs.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-50">
              <span className="app-icon-glyph text-5xl mb-4 text-gray-500"><AppIcon name={"history"}/></span>
              <p className="text-gray-400 font-medium">No logs recorded yet.</p>
           </div>
        ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 gap-3" : "flex flex-col gap-4"}>
                {sortedLogs.map((log) => {
                const date = new Date(log.date);
                const day = date.getDate();
                const month = date.toLocaleString('default', { month: 'short' });
                
                return (
                    <button
                    key={log.date}
                    onClick={() => setSelectedLog(log)}
                    className={`bg-surface-dark rounded-[20px] p-4 text-left border border-white/5 hover:border-white/10 active:scale-[0.98] transition-all shadow-sm group
                        ${viewMode === 'grid' ? 'flex flex-col gap-3 min-h-[140px] justify-between' : 'flex items-center gap-4'}
                    `}
                    >
                    {/* Header: Date Badge & Arrow (Grid) */}
                    <div className={viewMode === 'grid' ? "flex justify-between items-start w-full" : ""}>
                         <div className={`flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/5 ${viewMode === 'grid' ? 'w-12 h-12' : 'w-14 h-14'}`}>
                            <span className="text-[10px] uppercase font-bold text-gray-500">{month}</span>
                            <span className={`${viewMode === 'grid' ? 'text-lg' : 'text-xl'} font-bold text-white leading-none mt-0.5`}>{day}</span>
                        </div>
                        {viewMode === 'grid' && (
                             <span className="app-icon-glyph text-gray-600 group-hover:text-white transition-colors"><AppIcon name={"arrow_outward"}/></span>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className={`flex gap-2 mb-1 ${viewMode === 'grid' ? 'flex-wrap' : 'items-center'}`}>
                        {log.flow && (
                            <span className="bg-[#B04E75]/20 text-[#D14D72] text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border border-[#B04E75]/10 whitespace-nowrap">
                                {log.flow} Flow
                            </span>
                        )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-gray-300 truncate">
                            {log.moods && log.moods.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <span className="app-icon-glyph text-[14px] text-teal-400"><AppIcon name={"face"}/></span>
                                    {log.moods[0]} {viewMode === 'grid' && log.moods.length > 1 ? `+${log.moods.length - 1}` : ''}
                                     {viewMode === 'list' && log.moods.length > 1 && `+${log.moods.length - 1}`}
                                </span>
                            )}
                            {viewMode === 'list' && log.symptoms && log.symptoms.length > 0 && (
                                <span className="flex items-center gap-1 text-gray-400">
                                    • {log.symptoms.length} symptoms
                                </span>
                            )}
                        </div>
                    </div>

                    {viewMode === 'list' && (
                        <span className="app-icon-glyph text-gray-600"><AppIcon name={"chevron_right"}/></span>
                    )}
                    </button>
                );
                })}
            </div>
        )}
      </main>

      {/* Log Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <MotionPortal><motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background-dark dark:bg-surface-dark w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative border border-gray-100 dark:border-white/5 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => setSelectedLog(null)}
                className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-white/5 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                <span className="app-icon-glyph text-sm block"><AppIcon name={"close"}/></span>
              </button>
              <div className="flex flex-col items-center mb-6 mt-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <span className="text-3xl">{getMoodEmoji(selectedLog.moods?.[0] || '')}</span>
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] dark:text-white capitalize">
                  {new Date(selectedLog.date).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 capitalize">{selectedLog.moods?.[0] || 'No mood logged'}</p>
              </div>

              <div className="space-y-4">
                {selectedLog.flow && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-pink-50 dark:bg-pink-500/10">
                    <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">Flow</span>
                    <span className="text-sm font-bold text-pink-700 dark:text-pink-300 capitalize">{selectedLog.flow}</span>
                  </div>
                )}
                
                {selectedLog.symptoms && selectedLog.symptoms.length > 0 && (
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Symptoms</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedLog.symptoms.map((s: string) => (
                        <span key={s} className="px-3 py-1 bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-xl border border-gray-100 dark:border-white/5 capitalize">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLog.notes && (
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Note</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic mt-2">"{selectedLog.notes}"</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div></MotionPortal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LogHistory;
