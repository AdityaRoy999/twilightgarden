import { AppIcon } from '../../components/ui/Icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const AdminProfile: React.FC = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const { theme, toggleTheme, primaryColor } = useTheme();
    const isDark = theme === 'dark';

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/welcome');
        } catch { alert('Could not sign out. Check your connection and retry.'); }
    };

    return (
        <div className={`animate-slideIn font-display flex flex-col pb-24 min-h-screen transition-colors duration-300 bg-background-dark`}>
            <header className={`flex items-center px-6 pt-8 pb-4`}>
                <h2 className={`text-2xl font-bold leading-tight tracking-tight ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>Settings</h2>
            </header>

            {/* Profile Card */}
            <div className="px-6 mb-8">
                <div className={`rounded-2xl p-5 shadow-soft border flex flex-col items-center gap-4 transition-colors ${
                    isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                }`}>
                    <div className="relative">
                        <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center border-4 border-white dark:border-[#1E1B24] shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 15c-3.866 0-7 1.79-7 4v2h14v-2c0-2.21-3.134-4-7-4z"/>
                                <circle cx="12" cy="7" r="4"/>
                                <path d="M22 7h-5"/>
                                <path d="M19 4v6"/>
                            </svg>
                        </div>
                    </div>
                    <div className="text-center">
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>{user?.name || 'Administrator'}</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        Administrator
                    </span>
                </div>
            </div>

            {/* App Preferences */}
            <div className="px-6 mb-8">
                <h3 className={`text-lg font-bold mb-3 px-1 ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>App Preferences</h3>
                <div className={`rounded-2xl border overflow-hidden shadow-soft transition-colors ${
                    isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                }`}>
                    {/* Theme Toggle */}
                    <div
                        className={`flex items-center justify-between p-4 transition-colors cursor-pointer group ${
                            isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                        }`}
                        onClick={toggleTheme}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center rounded-xl w-10 h-10 group-hover:scale-105 transition-transform ${
                                isDark ? 'bg-white/5 text-purple-300' : 'bg-gray-50 text-orange-500'
                            }`}>
                                <span className="app-icon-glyph"><AppIcon name={isDark ? 'dark_mode' : 'light_mode'}/></span>
                            </div>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-[var(--text-primary)]'}`}>Dark Mode</span>
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{isDark ? 'On' : 'Off'}</span>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                            <input className="sr-only peer" type="checkbox" checked={isDark} readOnly />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    {/* App Theme Color Link */}
                    <div
                        className={`flex items-center justify-between p-4 transition-colors cursor-pointer group border-t ${
                            isDark ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                        onClick={() => navigate('/admin/settings/theme')}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-10 h-10 rounded-xl shadow-sm border flex items-center justify-center transition-transform group-hover:scale-105 ${
                                    isDark ? 'border-white/10' : 'border-black/5'
                                }`}
                                style={{ backgroundColor: primaryColor }}
                            >
                                 <span className="app-icon-glyph text-white text-lg drop-shadow-md"><AppIcon name={"palette"}/></span>
                            </div>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-[var(--text-primary)]'}`}>App Theme Color</span>
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Customize appearance</span>
                            </div>
                        </div>
                        <span className={`app-icon-glyph text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}><AppIcon name={"arrow_forward_ios"}/></span>
                    </div>
                </div>
            </div>

            {/* Account Info */}
            <div className="px-6 mb-8">
                <h3 className={`text-lg font-bold mb-3 px-1 ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>Account Info</h3>
                <div className={`rounded-2xl border overflow-hidden shadow-soft transition-colors ${
                    isDark ? 'bg-surface-dark border-white/5 shadow-none' : 'bg-white border-gray-100'
                }`}>
                    <div className={`flex items-center gap-3 p-4 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                        <div className={`flex items-center justify-center rounded-xl w-10 h-10 ${
                            isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-500'
                        }`}>
                            <span className="app-icon-glyph"><AppIcon name={"badge"}/></span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-[var(--text-primary)]'}`}>Role</span>
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>System Administrator</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4">
                        <div className={`flex items-center justify-center rounded-xl w-10 h-10 ${
                            isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-500'
                        }`}>
                            <span className="app-icon-glyph"><AppIcon name={"verified_user"}/></span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-[var(--text-primary)]'}`}>Access Level</span>
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Full Access</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logout Button */}
            <div className="px-6">
                <button
                    onClick={handleLogout}
                    className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
                        isDark
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                            : 'bg-red-50 hover:bg-red-100 text-red-500 border border-red-100'
                    }`}
                >
                    <span className="app-icon-glyph text-lg"><AppIcon name={"logout"}/></span>
                    Sign Out
                </button>
            </div>
        </div>
    );
};

export default AdminProfile;
