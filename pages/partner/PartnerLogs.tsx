import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { useCouples } from '../../contexts/CouplesContext';

const PartnerLogs: React.FC = () => {
    const { theme, primaryColor } = useTheme();
    const { partnerLogs, partnerProfile, fetchPartnerData, isLoading: isCouplesLoading } = useCouples();
    const isDark = theme === 'dark';

    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    useEffect(() => {
        fetchPartnerData();
    }, []);

    if (isCouplesLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-gray-800'}`}>
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className={`animate-slideIn font-display flex flex-col pb-24 min-h-screen transition-colors duration-300 bg-background-dark`}>
            <header className={`flex items-center justify-between px-6 pt-12 pb-6 ${isDark ? '' : ''}`}>
                <div>
                    <h2 className={`text-2xl font-bold leading-tight tracking-tight ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                        {partnerProfile?.full_name ? `${partnerProfile.full_name}'s Logs` : 'Partner Logs'}
                    </h2>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Last 30 days</p>
                </div>

                {/* View Toggle */}
                <div className={`relative flex items-center rounded-xl p-1 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`relative p-2 rounded-lg transition-colors z-10 ${viewMode === 'list'
                            ? 'text-white'
                            : isDark
                                ? 'text-gray-500 hover:text-gray-300'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {viewMode === 'list' && (
                            <motion.div
                                layoutId="view-toggle-indicator-partner"
                                className="absolute inset-0 rounded-lg shadow-sm"
                                style={{ backgroundColor: primaryColor || '#984369' }}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                            />
                        )}
                        <span className="material-symbols-outlined text-[18px]">view_list</span>
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`relative p-2 rounded-lg transition-colors z-10 ${viewMode === 'grid'
                            ? 'text-white'
                            : isDark
                                ? 'text-gray-500 hover:text-gray-300'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {viewMode === 'grid' && (
                            <motion.div
                                layoutId="view-toggle-indicator-partner"
                                className="absolute inset-0 rounded-lg shadow-sm"
                                style={{ backgroundColor: primaryColor || '#984369' }}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                            />
                        )}
                        <span className="material-symbols-outlined text-[18px]">grid_view</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 px-6">
                {partnerLogs.length === 0 ? (
                    <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-30">description</span>
                        <p>No logs shared yet.</p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                        {partnerLogs.map((log: any, index: number) => {
                            const date = new Date(log.date);
                            const day = date.getDate();
                            const month = date.toLocaleString('default', { month: 'short' });

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`rounded-2xl shadow-soft border transition-colors ${isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                                        } ${viewMode === 'grid' ? 'p-4 flex flex-col justify-between min-h-[140px]' : 'p-4'}`}
                                >
                                    {viewMode === 'list' ? (
                                        <>
                                            <div className="flex items-center justify-between mb-3">
                                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                                                    {date.toLocaleDateString('en-US', {
                                                        weekday: 'short',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                                {log.flow && (
                                                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-500/20">
                                                        {log.flow}
                                                    </span>
                                                )}
                                            </div>

                                            {(log.moods || []).length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {log.moods.map((m: string, i: number) => (
                                                        <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
                                                            {m}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {(log.symptoms || []).length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {log.symptoms.map((s: string, i: number) => (
                                                        <span key={i} className={`text-xs px-2.5 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {log.notes && (
                                                <p className={`text-xs mt-3 italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>"{log.notes}"</p>
                                            )}

                                            {(log.energyLevel || log.sleepQuality) && (
                                                <div className="flex gap-4 mt-3 border-t border-gray-50 dark:border-white/5 pt-3">
                                                    {log.energyLevel && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[14px] text-yellow-500">bolt</span>
                                                            <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{log.energyLevel} Energy</span>
                                                        </div>
                                                    )}
                                                    {log.sleepQuality && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[14px] text-indigo-500">bedtime</span>
                                                            <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                {log.sleepQuality}
                                                                {log.sleepHours ? ` (${log.sleepHours}h)` : ''}
                                                                Sleep
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start w-full">
                                                <div className={`flex flex-col items-center justify-center rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'} w-12 h-12`}>
                                                    <span className={`text-[10px] uppercase font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{month}</span>
                                                    <span className={`text-lg font-bold leading-none mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{day}</span>
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0 mt-3">
                                                {log.flow && (
                                                    <div className="flex gap-2 mb-1 flex-wrap">
                                                        <span className="bg-[#B04E75]/20 text-[#D14D72] text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border border-[#B04E75]/10 whitespace-nowrap">
                                                            {log.flow} Flow
                                                        </span>
                                                    </div>
                                                )}

                                                <div className={`flex flex-col gap-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    <div className="flex items-center gap-3 truncate">
                                                        {(log.moods || []).length > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[14px] text-teal-500">face</span>
                                                                <span className="truncate">{log.moods[0]} {(log.moods || []).length > 1 ? `+${(log.moods || []).length - 1}` : ''}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {(log.energyLevel || log.energy_level) && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[14px] text-yellow-500">bolt</span>
                                                                <span className="capitalize">{log.energyLevel || log.energy_level}</span>
                                                            </span>
                                                        )}
                                                        {(log.sleepQuality || log.sleep_quality) && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[14px] text-indigo-500">bedtime</span>
                                                                <span className="capitalize">
                                                                    {log.sleepQuality || log.sleep_quality}
                                                                    {(log.sleepHours || log.sleep_hours) ? ` (${log.sleepHours || log.sleep_hours}h)` : ''}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default PartnerLogs;
