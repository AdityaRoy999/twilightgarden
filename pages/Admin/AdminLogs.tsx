import { AppIcon } from '../../components/ui/Icons';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { useAdmin } from '../../contexts/AdminContext';

interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
}

interface DailyLog {
    id: string;
    user_id: string;
    date: string;
    flow: string | null;
    moods: string[];
    symptoms: string[];
    notes: string | null;
}

const AdminLogs: React.FC = () => {
    const { theme, primaryColor } = useTheme();
    const { users, isLoading: isContextLoading } = useAdmin();
    const isDark = theme === 'dark';
    
    // Local state for checking logs of a specific user
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [logs, setLogs] = useState<DailyLog[]>([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    // No need to fetch users, useAdmin provides them
    
    const handleUserClick = async (user: UserProfile) => {
        setSelectedUser(user);
        setIsLogsLoading(true);
        
        try {
            const { data, error } = await supabase
                .from('daily_logs')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setIsLogsLoading(false);
        }
    };

    const handleBack = () => {
        setSelectedUser(null);
        setLogs([]);
    };

    if (isContextLoading && users.length === 0 && !selectedUser) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center gap-4 transition-colors bg-background-dark`}>
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-3 rounded-full border-primary border-t-transparent"
                    style={{ borderWidth: '3px' }}
                />
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading users...</p>
            </div>
        );
    }

    // Show user's logs
    if (selectedUser) {
        return (
            <div className={`animate-slideIn font-display flex flex-col pb-24 min-h-screen transition-colors duration-300 bg-background-dark`}>
                <header className={`flex items-center gap-4 px-6 py-6 sticky top-0 z-20 backdrop-blur-sm transition-colors duration-300 ${
                    isDark ? 'bg-background-dark/95' : 'bg-background-dark/95'
                }`}>
                    <motion.button 
                        onClick={handleBack}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-white hover:bg-gray-50 text-gray-500 shadow-sm border border-gray-100'
                        }`}
                    >
                        <AppIcon name="ArrowLeft" size={24}/>
                    </motion.button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full overflow-hidden border-2 shadow-sm ${isDark ? 'border-white/10' : 'border-white'}`}>
                            {selectedUser.avatar_url ? (
                                <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                                    <span className="text-sm font-bold">{selectedUser.full_name?.charAt(0) || '?'}</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>{selectedUser.full_name || 'Anonymous'}</h2>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{logs.length} log entries</p>
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className={`relative flex p-1 rounded-xl border w-[84px] ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                        {/* Animated Pill */}
                        <div 
                            className={`absolute top-1 bottom-1 w-[38px] rounded-lg shadow-sm transition-all duration-300 ease-out z-0`}
                            style={{ 
                                transform: viewMode === 'list' ? 'translateX(0)' : 'translateX(100%)',
                                backgroundColor: primaryColor || '#984369'
                            }}
                        ></div>

                        <button 
                            onClick={() => setViewMode('list')}
                            className={`relative z-10 flex-1 flex items-center justify-center p-1.5 rounded-lg transition-colors duration-200 ${
                                viewMode === 'list' 
                                    ? 'text-white'
                                    : (isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600')
                            }`}
                        >
                            <span className="app-icon-glyph text-[20px]"><AppIcon name={"view_list"}/></span>
                        </button>
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`relative z-10 flex-1 flex items-center justify-center p-1.5 rounded-lg transition-colors duration-200 ${
                                viewMode === 'grid' 
                                    ? 'text-white'
                                    : (isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600')
                            }`}
                        >
                            <span className="app-icon-glyph text-[20px]"><AppIcon name={"grid_view"}/></span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 px-6">
                    {isLogsLoading ? (
                        <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading logs...</div>
                    ) : logs.length === 0 ? (
                        <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            <span className="app-icon-glyph text-4xl mb-2 opacity-30"><AppIcon name={"description"}/></span>
                            <p>No logs found for this user.</p>
                        </div>
                    ) : (
                        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                            {logs.map((log, index) => {
                                const date = new Date(log.date);
                                const day = date.getDate();
                                const month = date.toLocaleString('default', { month: 'short' });

                                return (
                                <motion.div 
                                    key={log.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`rounded-2xl shadow-soft border transition-colors ${
                                        isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
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
                                                    {log.moods.map((m, i) => (
                                                        <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
                                                            {m}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {(log.symptoms || []).length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {log.symptoms.map((s, i) => (
                                                        <span key={i} className={`text-xs px-2.5 py-1 rounded-full ${
                                                            isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {log.notes && (
                                                <p className={`text-xs mt-3 italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>"{log.notes}"</p>
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
                                                
                                                <div className={`flex items-center gap-3 text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    {(log.moods || []).length > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="app-icon-glyph text-[14px] text-teal-500"><AppIcon name={"face"}/></span>
                                                            {log.moods[0]} {(log.moods || []).length > 1 ? `+${(log.moods || []).length - 1}` : ''}
                                                        </span>
                                                    )}
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
    }

    // Show users list
    return (
        <div className={`animate-slideIn font-display flex flex-col pb-24 min-h-screen transition-colors duration-300 bg-background-dark`}>
            <header className={`flex items-center justify-between px-6 pt-8 pb-4 ${isDark ? '' : ''}`}>
                <h2 className={`text-2xl font-bold leading-tight tracking-tight ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>User Logs</h2>
                
                {/* View Toggle */}
                <div className={`relative flex items-center rounded-xl p-1 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`relative p-2 rounded-lg transition-colors z-10 ${
                            viewMode === 'list'
                                ? 'text-white' 
                                : isDark 
                                    ? 'text-gray-500 hover:text-gray-300' 
                                    : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {viewMode === 'list' && (
                            <motion.div
                                layoutId="view-toggle-indicator-main"
                                className="absolute inset-0 rounded-lg shadow-sm"
                                style={{ backgroundColor: primaryColor || '#984369' }}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                            />
                        )}
                        <AppIcon name="List" size={24}/>
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`relative p-2 rounded-lg transition-colors z-10 ${
                            viewMode === 'grid'
                                ? 'text-white' 
                                : isDark 
                                    ? 'text-gray-500 hover:text-gray-300' 
                                    : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {viewMode === 'grid' && (
                            <motion.div
                                layoutId="view-toggle-indicator-main"
                                className="absolute inset-0 rounded-lg shadow-sm"
                                style={{ backgroundColor: primaryColor || '#984369' }}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                            />
                        )}
                        <AppIcon name="Grid2X2" size={24}/>
                    </button>
                </div>
            </header>
            
            <main className="flex-1 px-6">
                {users.length === 0 ? (
                    <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className="app-icon-glyph text-4xl mb-2 opacity-30"><AppIcon name={"group"}/></span>
                        <p>No users found.</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {viewMode === 'list' ? (
                            /* List View */
                            <motion.div 
                                key="list-view"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className={`rounded-2xl overflow-hidden shadow-soft border transition-colors ${
                                    isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                                }`}
                            >
                                {users.map((user, index) => (
                                    <motion.button
                                        key={user.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        onClick={() => handleUserClick(user)}
                                        className={`w-full p-4 flex items-center gap-4 transition-colors text-left ${
                                            isDark 
                                                ? 'hover:bg-white/5 border-b border-white/5 last:border-b-0' 
                                                : 'hover:bg-gray-50 border-b border-gray-100 last:border-b-0'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 shadow-sm ${
                                            isDark ? 'border-white/10' : 'border-white'
                                        }`}>
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                                                    <span className="text-sm font-bold">{user.full_name?.charAt(0) || '?'}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-medium truncate ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>{user.full_name || 'Anonymous'}</h3>
                                            <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{user.email}</p>
                                        </div>
                                        <span className={`app-icon-glyph text-sm ${isDark ? 'text-gray-600' : 'text-gray-300'}`}><AppIcon name={"chevron_right"}/></span>
                                    </motion.button>
                                ))}
                            </motion.div>
                        ) : (
                            /* Grid View */
                            <motion.div 
                                key="grid-view"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-2 gap-3"
                            >
                                {users.map((user, index) => (
                                    <motion.button
                                        key={user.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.03 }}
                                        onClick={() => handleUserClick(user)}
                                        className={`p-4 rounded-2xl shadow-soft border transition-all text-center ${
                                            isDark 
                                                ? 'bg-surface-dark border-white/5 shadow-none hover:bg-white/5' 
                                                : 'bg-white border-gray-100 hover:shadow-md'
                                        }`}
                                    >
                                        <div className={`w-14 h-14 rounded-full overflow-hidden mx-auto mb-3 border-2 shadow-sm ${
                                            isDark ? 'border-white/10' : 'border-white'
                                        }`}>
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                                                    <span className="text-lg font-bold">{user.full_name?.charAt(0) || '?'}</span>
                                                </div>
                                            )}
                                        </div>
                                        <h3 className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>{user.full_name || 'Anonymous'}</h3>
                                        <p className={`text-[10px] truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{user.email}</p>
                                    </motion.button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </main>
        </div>
    );
};

export default AdminLogs;
