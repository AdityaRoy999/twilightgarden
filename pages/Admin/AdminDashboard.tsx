import { AppIcon } from '../../components/ui/Icons';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useCouples } from '../../contexts/CouplesContext';
import { useAdmin } from '../../contexts/AdminContext';
import { Database } from '../../types';
import Toast from '../../components/Toast';
import { AnimatedRefreshIcon } from '../../components/ui/AnimatedIcons';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

const AdminDashboard: React.FC = () => {
    const { user, signOut } = useAuth();
    const { theme } = useTheme();
    const { generatePairingCode, couple } = useCouples();
    const { stats, users, recentLogs, isLoading, refreshData } = useAdmin();
    const isDark = theme === 'dark';
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pairingCode, setPairingCode] = useState<string | null>(null);

    const [toast, setToast] = useState<{ isVisible: boolean; message: string; subMessage?: string; type: 'success' | 'error' }>({ 
        isVisible: false, 
        message: '', 
        type: 'success' 
    });
    
    const showLocalToast = (message: string, subMessage?: string, type: 'success' | 'error' = 'success') => {
        setToast({ isVisible: true, message, subMessage, type });
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshData();
        setIsRefreshing(false);
    };

    const handleGenerateCode = async () => {
        try {
            const code = await generatePairingCode();
            setPairingCode(code);
            showLocalToast('Code Generated', `Pairing Code: ${code}`);
        } catch (error) {
            console.error(error);
            showLocalToast('Error', 'Failed to generate code', 'error');
        }
    };

    if (isLoading && users.length === 0) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center gap-4 transition-colors bg-background-dark`}>
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-3 rounded-full border-primary border-t-transparent"
                    style={{ borderWidth: '3px' }}
                />
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading Dashboard...</p>
            </div>
        );
    }

    return (
        <div className={`animate-slideIn font-display flex flex-col pb-24 min-h-screen transition-colors duration-300 bg-background-dark`}>
            {/* Admin Header */}
            <header className={`flex items-center justify-between px-6 py-6 sticky top-0 z-20 backdrop-blur-sm transition-colors duration-300 ${
                isDark ? 'bg-background-dark/95' : 'bg-background-dark/95'
            }`}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-md">
                            <AppIcon name="ChartNoAxesCombined" size={24}/>
                        </div>
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#4ADE80] border-2 border-[#FDFCF8] dark:border-[#121014] rounded-full"></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-400">Welcome back,</span>
                        <h2 className={`text-xl font-bold leading-tight ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>Admin</h2>
                    </div>
                </div>
                <motion.button 
                    onClick={handleRefresh}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-white hover:bg-gray-50 text-gray-500 shadow-sm border border-gray-100'
                    }`}
                >
                    <AnimatedRefreshIcon isActive={isRefreshing} size={20} />
                </motion.button>
            </header>

            <main className="flex-1 px-6 flex flex-col gap-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Total Users Card */}
                    <div className={`p-5 rounded-[24px] shadow-soft border group hover:shadow-md transition-shadow ${
                        isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                    }`}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="app-icon-glyph text-primary text-lg"><AppIcon name={"group"}/></span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total Users</span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-2xl font-bold mb-0.5 ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>{stats.totalUsers}</span>
                            <span className="text-xs font-medium text-gray-400">registered</span>
                        </div>
                    </div>

                    {/* Active Today Card */}
                    <div className={`p-5 rounded-[24px] shadow-soft border group hover:shadow-md transition-shadow ${
                        isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                    }`}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="app-icon-glyph text-[#4ECDC4] text-lg"><AppIcon name={"trending_up"}/></span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Active Today</span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-2xl font-bold mb-0.5 ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>{stats.activeToday}</span>
                            <span className="text-xs font-medium text-gray-400">logged today</span>
                        </div>
                    </div>
                </div>

                {/* Love Lock Card - Full Width */}
                {couple?.status === 'active' ? (
                    /* Couple is already paired - show connected status */
                    <div className="on-brand w-full bg-gradient-to-r from-[#4ECDC4] to-[#44A08D] text-white p-6 rounded-[24px] shadow-lg shadow-[#4ECDC4]/20 flex items-center justify-between">
                        <div className="flex flex-col items-start gap-1">
                            <span className="text-lg font-bold">Love Lock</span>
                            <span className="text-sm text-white/80 flex items-center gap-2">
                                <span className="app-icon-glyph text-sm"><AppIcon name={"check_circle"}/></span>
                                Connected
                            </span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="app-icon-glyph text-2xl"><AppIcon name={"favorite"}/></span>
                        </div>
                    </div>
                ) : (pairingCode || couple?.pairing_code) ? (
                    /* Show pending code - waiting for partner */
                    <div className="w-full bg-[#FF5A78] text-white p-6 rounded-[24px] shadow-lg shadow-[#FF5A78]/20 flex items-center justify-between">
                        <div className="flex flex-col items-start gap-1">
                            <span className="text-lg font-bold">Love Lock Code</span>
                            <span className="text-sm text-white/80 font-mono tracking-[0.3em]">
                                {pairingCode || couple?.pairing_code}
                            </span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="app-icon-glyph text-2xl"><AppIcon name={"favorite"}/></span>
                        </div>
                    </div>
                ) : (
                    /* Generate code button */
                    <button 
                        onClick={handleGenerateCode}
                        className="w-full bg-[#FF5A78] hover:bg-[#E04F6B] text-white p-6 rounded-[24px] shadow-lg shadow-[#FF5A78]/20 flex items-center justify-between group transition-all active:scale-[0.98]"
                    >
                        <div className="flex flex-col items-start gap-1">
                            <span className="text-lg font-bold">Love Lock Code</span>
                            <span className="text-sm text-white/80 font-mono tracking-[0.3em]">
                                Generate Code
                            </span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                            <span className="app-icon-glyph text-2xl"><AppIcon name={"favorite"}/></span>
                        </div>
                    </button>
                )}

                {/* Users List */}
                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>Registered Users</h3>
                        <span className={`text-xs font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {users.length} total
                        </span>
                    </div>
                    
                    <div className={`rounded-2xl overflow-hidden shadow-soft border transition-colors ${
                        isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                    }`}>
                        {users.map((u, index) => (
                            <div 
                                key={u.id}
                                className={`flex items-center gap-4 p-4 transition-colors ${
                                    isDark 
                                        ? 'hover:bg-white/5 border-b border-white/5 last:border-b-0' 
                                        : 'hover:bg-gray-50 border-b border-gray-100 last:border-b-0'
                                }`}
                            >
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 shadow-sm ${
                                    isDark ? 'bg-gray-800 border-white/10' : 'bg-gray-100 border-white'
                                }`}>
                                    {u.avatar_url ? (
                                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center text-sm font-bold ${
                                            isDark ? 'text-gray-500 bg-gray-800' : 'text-gray-400 bg-gray-100'
                                        }`}>
                                            {u.full_name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                                            {u.full_name || 'Anonymous'}
                                        </span>
                                        {u.role === 'admin' && (
                                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-primary/10 text-primary">
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {u.email}
                                    </p>
                                </div>
                                
                                {/* Date */}
                                <span className={`text-[10px] font-medium flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {u.updated_at ? new Date(u.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            
            <Toast 
                message={toast.message}
                subMessage={toast.subMessage}
                isVisible={toast.isVisible}
                onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
                type={toast.type}
            />
        </div>
    );
};

export default AdminDashboard;
