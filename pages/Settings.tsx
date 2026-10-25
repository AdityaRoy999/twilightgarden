import { localDateKey } from '../lib/dates';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { exportHealthDataToPDF, exportDoctorsReport } from '../lib/exportPDF';
import TodayReportModal from '../components/TodayReportModal';
import Toast from '../components/Toast';
import { useCouples } from '../contexts/CouplesContext';
import { Smartphone, Monitor, Trash2, Clock, Shield } from 'lucide-react';
import { SyncHistoryModal } from '../components/SyncHistoryModal';

const Settings: React.FC = () => {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme, primaryColor, animationsEnabled, updateAnimationsEnabled, solidNavBg, updateSolidNavBg } = useTheme();
  const { cycleSettings, updateSettings, logs } = useData();
  const { deviceId } = useCouples();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const { hasCloudBackup } = useCouples();



  // Initialize from cache for instant load, with AuthContext fallback
  const [profile, setProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('twilight_profile');
      if (cached) return JSON.parse(cached);
    } catch {}
    // Fallback to AuthContext user data
    if (user) return { full_name: user.name, avatar_url: user.avatar_url, email: user.email };
    return null;
  });

  const [showTodayReport, setShowTodayReport] = useState(false);
  const [unlinkDeviceId, setUnlinkDeviceId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; subMessage?: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  // Get today's log
  const todayStr = localDateKey();
  const todayLog = logs.find(l => l.date === todayStr) || null;

  useEffect(() => {
    if (user) {
        // Only fetch from DB if cache is stale (> 5 minutes old) to prevent reload flash
        let shouldFetch = true;
        try {
          const cached = localStorage.getItem('twilight_profile');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed._cachedAt && Date.now() - parsed._cachedAt < 5 * 60 * 1000) {
              shouldFetch = false;
            }
          }
        } catch {}

        if (shouldFetch) fetchProfile();

        // Initial sync from Supabase metadata if available
        if (user.user_metadata) {
            if (user.user_metadata.animationsEnabled !== undefined && user.user_metadata.animationsEnabled !== animationsEnabled) {
                updateAnimationsEnabled(user.user_metadata.animationsEnabled);
            }
            if (user.user_metadata.solidNavBg !== undefined && user.user_metadata.solidNavBg !== solidNavBg) {
                updateSolidNavBg(user.user_metadata.solidNavBg);
            }
        }
    }
  }, [user]);


  const fetchProfile = async () => {
      try {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, bio, status, email, partner_nickname')
            .eq('id', user?.id)
            .single();

          if (data) {
              setProfile(data);
              localStorage.setItem('twilight_profile', JSON.stringify({ ...data, _cachedAt: Date.now() }));
          }

          // Also fetch devices
          fetchDevices();
      } catch (error) {
          console.error("Error fetching profile", error);
      }
  };

  const fetchDevices = async () => {
    if (!user) return;
    setIsLoadingDevices(true);
    const { data } = await (supabase
      .from('user_keys' as any)
      .select('device_id, device_name, last_active')
      .eq('user_id', user.id) as any);
    if (data) setDevices(data);
    setIsLoadingDevices(false);
  };

  const unlinkDevice = async (dId: string) => {
    if (!user || dId === deviceId) return;
    setUnlinkDeviceId(dId);
  };

  const confirmUnlinkDevice = async () => {
    if (!user || !unlinkDeviceId) return;
    const dId = unlinkDeviceId;
    setUnlinkDeviceId(null);

    const { error } = await (supabase
      .from('user_keys' as any)
      .delete()
      .eq('user_id', user.id)
      .eq('device_id', dId) as any);

    if (!error) {
      showToast('Device key removed', 'This removes its key registration. Existing sessions and cached keys remain valid.');
      fetchDevices();
    } else {
      showToast('Could not remove device key', 'Please retry.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/welcome');
    } catch {
      showToast('Could not sign out', 'Check your connection and retry.', 'error');
    }
  };

  const showToast = (message: string, subMessage?: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, subMessage, type, isVisible: true });
  };

  const handleExportPDF = async () => {
    try {
      await exportHealthDataToPDF({
        profile: {
          full_name: profile?.full_name || 'User',
          email: profile?.email || user?.email || '',
        },
        cycleSettings,
        logs,
      });
      // Success feedback is handled inside exportHealthDataToPDF for now, but ideally should return success
      // For now, we assume if no error, it triggered the save.
      // Note: exportHealthDataToPDF uses window.alert currently. We should update that too.
      // Ideally pass a callback or refactor to return status.
      // For this step, we'll let the user know process started.
      showToast('Export Started', 'Generating your health report...');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      showToast('Export Failed', 'Please try again', 'error');
    }
  };

  const handleDoctorsReport = async () => {
    try {
      await exportDoctorsReport({
        profile: {
          full_name: profile?.full_name || 'User',
          email: profile?.email || user?.email || '',
        },
        cycleSettings,
        logs,
      });
      showToast('Report Generated', 'Doctor\'s report is ready');
    } catch (error) {
      console.error('Failed to generate doctor report:', error);
      showToast('Generation Failed', 'Please try again', 'error');
    }
  };

  const handleToggleAnimations = async () => {
      const newValue = !animationsEnabled;
      updateAnimationsEnabled(newValue);

      const { error } = await supabase.auth.updateUser({
          data: { animationsEnabled: newValue }
      });
      if (error) {
          console.error('Failed to sync animation setting', error);
          updateAnimationsEnabled(!newValue); // Rollback on failure
      }
  };

  const handleToggleSolidNav = async () => {
      const newValue = !solidNavBg;
      updateSolidNavBg(newValue);

      const { error } = await supabase.auth.updateUser({
          data: { solidNavBg: newValue }
      });
      if (error) {
          console.error('Failed to sync solid nav setting', error);
          updateSolidNavBg(!newValue); // Rollback on failure
      }
  };

  return (
    <div className="animate-slideIn font-display flex flex-col pb-24 bg-[#FDFCF8] dark:bg-background-dark min-h-screen transition-colors duration-300">
      {/* Global Toast */}
      <Toast
        message={toast.message}
        subMessage={toast.subMessage}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      {/* Unlink Device Confirmation */}
      {unlinkDeviceId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-6" onClick={() => setUnlinkDeviceId(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2 dark:text-white">Remove device key</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">Remove this device's public-key registration? This does not sign the device out or erase its cached keys. It can register again while signed in.</p>
            <div className="flex gap-3">
              <button onClick={() => setUnlinkDeviceId(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium">Cancel</button>
              <button onClick={confirmUnlinkDevice} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium">Remove key</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center px-6 pt-8 pb-4 bg-transparent">
        <h2 className="text-[#121014] dark:text-white text-2xl font-bold leading-tight tracking-tight">Settings</h2>
      </header>

      <div className="px-6 mb-8">
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-soft border border-gray-100 dark:border-white/5 flex flex-col md:flex-row items-center md:items-start gap-6 transition-colors max-w-4xl mx-auto">
          <div className="relative group cursor-pointer shrink-0" onClick={() => navigate('/settings/profile')}>
            <div
              className="h-24 w-24 md:h-28 md:w-28 rounded-full bg-cover bg-center border-4 border-white dark:border-[#1E1B24] shadow-md transition-transform group-hover:scale-[1.02]"
              style={{
                backgroundImage:
                  `url("${profile?.avatar_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ccc'%3E%3Ccircle cx='50' cy='40' r='20'/%3E%3Cellipse cx='50' cy='85' rx='30' ry='22'/%3E%3C/svg%3E"}")`,
              }}
            ></div>
            <button className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full border-2 border-white dark:border-[#1E1B24] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
          </div>
          <div className="text-center md:text-left flex-grow flex flex-col justify-center">
            <h3 className="text-xl md:text-2xl font-bold text-[#121014] dark:text-white mb-1">{profile?.full_name || 'User'}</h3>
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-4">{user?.email}</p>
            <button
              onClick={() => navigate('/settings/profile')}
              className="w-full md:w-auto py-2.5 px-6 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm transition-colors"
            >
              Edit Profile Details
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 mb-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-8">

          {/* Left Column Settings */}
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-[#121014] dark:text-white text-lg font-bold mb-3 px-1">App Preferences</h3>
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-soft transition-colors mb-4">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group" onClick={toggleTheme}>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 ${theme === 'dark' ? 'text-purple-300' : 'text-orange-500'} w-10 h-10 group-hover:scale-105 transition-transform`}>
                      <span className="material-symbols-outlined">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#121014] dark:text-gray-200">Dark Mode</span>
                      <span className="text-xs text-gray-500">{theme === 'dark' ? 'On' : 'Off'}</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                    <input className="sr-only peer" type="checkbox" checked={theme === 'dark'} readOnly />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Animations Toggle */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group" onClick={handleToggleAnimations}>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 text-blue-400 w-10 h-10 group-hover:scale-105 transition-transform`}>
                      <span className="material-symbols-outlined">{animationsEnabled ? 'animation' : 'stop_circle'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#121014] dark:text-gray-200">Enable Animations</span>
                      <span className="text-xs text-gray-500">{animationsEnabled ? 'Flowing interactions' : 'Reduced motion'}</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                    <input className="sr-only peer" type="checkbox" checked={animationsEnabled} readOnly />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Solid Nav Bg Toggle */}
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group" onClick={handleToggleSolidNav}>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 text-teal-500 w-10 h-10 group-hover:scale-105 transition-transform`}>
                      <span className="material-symbols-outlined">{solidNavBg ? 'layers_clear' : 'blur_on'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#121014] dark:text-gray-200">Solid Navbar Background</span>
                      <span className="text-xs text-gray-500">{solidNavBg ? 'Opaque (Solid Color)' : 'Glassmorphism (Blur)'}</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                    <input className="sr-only peer" type="checkbox" checked={solidNavBg} readOnly />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {/* Color Theme Customization Link */}
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 p-1 shadow-soft transition-colors mt-4">
                  <div
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer rounded-xl group"
                      onClick={() => navigate('/settings/theme')}
                  >
                      <div className="flex items-center gap-3">
                          <div
                              className="w-10 h-10 rounded-xl shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center transition-transform group-hover:scale-105"
                              style={{ backgroundColor: primaryColor }}
                          >
                               <span className="material-symbols-outlined text-white text-lg drop-shadow-md">palette</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="font-medium text-[#121014] dark:text-gray-200">App Theme Color</span>
                              <span className="text-xs text-gray-500">Customize appearance</span>
                          </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-sm">arrow_forward_ios</span>
                  </div>
              </div>
            </div>

            <div>
              <h3 className="text-[#121014] dark:text-white text-lg font-bold mb-3 px-1">App Settings</h3>
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-soft transition-colors">
                  <div
                      className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => navigate('/notes')}
                  >
                      <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-900/20 text-pink-500 w-10 h-10 group-hover:scale-105 transition-transform">
                              <span className="material-symbols-filled">favorite</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="font-medium text-[#121014] dark:text-gray-200">Love Lock</span>
                              <span className="text-xs text-gray-500">Couples Space</span>
                          </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-sm">arrow_forward_ios</span>
                  </div>
                  <div
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => navigate('/settings/notifications')}
                  >
                      <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 text-pink-500 w-10 h-10 group-hover:scale-105 transition-transform">
                              <span className="material-symbols-outlined">notifications</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="font-medium text-[#121014] dark:text-gray-200">Manage Notifications</span>
                              <span className="text-xs text-gray-500">Period alerts & daily reminders</span>
                          </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-sm">arrow_forward_ios</span>
                  </div>
              </div>
            </div>

            <div>
              <h3 className="text-[#121014] dark:text-white text-lg font-bold mb-3 px-1">Partner Settings</h3>
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-soft transition-colors p-4">
                  <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Partner Nickname</label>
                      <div className="relative">
                          <input
                              type="text"
                              placeholder="e.g. Puchii, Tutii"
                              defaultValue={profile?.partner_nickname || ''}
                              onBlur={async (e) => {
                                  const val = e.target.value.trim();
                                  if (val !== profile?.partner_nickname) {
                                      const { error } = await supabase
                                          .from('profiles')
                                          .update({ partner_nickname: val })
                                          .eq('id', user?.id as string);
                                      if (!error) {
                                          showToast('Nickname Saved', `Partner will be called ${val}`);
                                          setProfile({ ...profile, partner_nickname: val });
                                      }
                                  }
                              }}
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-[#121014] dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          />
                          <span className="material-symbols-outlined absolute right-3 top-3 text-gray-400 pointer-events-none">edit_note</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">This name will be used in notifications you receive.</p>
                  </div>
              </div>
            </div>
          </div>

          {/* Right Column Settings */}
          <div className="flex flex-col gap-6">

            <div>
              <h3 className="text-[#121014] dark:text-white text-lg font-bold mb-3 px-1">Cycle Preferences</h3>
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-soft transition-colors">
                {[
                  { icon: 'cached', label: 'Cycle Length', value: `${cycleSettings.avgCycleLength} days`, color: 'text-primary', link: '/settings/cycle-length' },
                  { icon: 'water_drop', label: 'Period Length', value: `${cycleSettings.avgPeriodLength} days`, color: 'text-purple-400', link: '/settings/period-length' },
                ].map((item, i) => (
                  <div
                      key={i}
                      className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => navigate(item.link)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 ${item.color} w-10 h-10 group-hover:scale-105 transition-transform`}>
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <span className="font-medium text-[#121014] dark:text-gray-200">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#121014] dark:text-white font-semibold">{item.value}</span>
                      <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-sm">arrow_forward_ios</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 text-amber-500 dark:text-amber-300 w-10 h-10">
                      <span className="material-symbols-outlined">waves</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#121014] dark:text-gray-200">Irregular Cycle</span>
                      <span className="text-xs text-gray-500">Don't predict future dates</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      className="sr-only peer"
                      type="checkbox"
                      checked={cycleSettings.irregularCycle}
                      onChange={() => { void updateSettings({ irregularCycle: !cycleSettings.irregularCycle }).catch(err => showToast('Could not save settings', err.message, 'error')); }}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[#121014] dark:text-white text-lg font-bold mb-3 px-1">My Data</h3>
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-soft transition-colors">
                  <div
                      className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => navigate('/settings/history')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 text-pink-500 w-10 h-10 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined">history</span>
                      </div>
                      <span className="font-medium text-[#121014] dark:text-gray-200">Log History</span>
                    </div>
                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-sm">arrow_forward_ios</span>
                  </div>

                  <div
                      className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => setShowSyncModal(true)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-900/20 text-pink-500 w-10 h-10 group-hover:scale-105 transition-transform">
                        <Shield size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-[#121014] dark:text-gray-200">Encryption & Sync</span>
                        <span className="text-xs text-gray-500">
                          {hasCloudBackup ? 'Keys Backed Up' : 'Backup required'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!hasCloudBackup && (
                        <span className="px-2 py-0.5 bg-pink-500 text-white text-[10px] font-bold rounded-full animate-pulse uppercase">Set Pin</span>
                      )}
                      <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-sm">arrow_forward_ios</span>
                    </div>
                  </div>
              </div>
            </div>

            <div>
              <h3 className="text-[#121014] dark:text-white text-lg font-bold mb-3 px-1">Support & Data</h3>
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col shadow-soft transition-colors">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-xl bg-gray-50 dark:bg-white/5 text-primary w-10 h-10">
                      <span className="material-symbols-outlined">download</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#121014] dark:text-gray-200">Export Health Data</span>
                      <span className="text-xs text-gray-500">Download PDF report</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 dark:text-gray-600">chevron_right</span>
                </button>
                <button
                  onClick={handleDoctorsReport}
                  className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 w-10 h-10">
                      <span className="material-symbols-outlined">medical_information</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#121014] dark:text-gray-200">Generate Doctor's Report</span>
                      <span className="text-xs text-gray-500">Medical summary for healthcare providers</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 dark:text-gray-600">chevron_right</span>
                </button>
                <button
                  onClick={() => setShowTodayReport(true)}
                  className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-500 w-10 h-10">
                      <span className="material-symbols-outlined">today</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#121014] dark:text-gray-200">Today's Report Card</span>
                      <span className="text-xs text-gray-500">Download today's symptoms as PNG/PDF</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 dark:text-gray-600">chevron_right</span>
                </button>
                <button onClick={handleLogout} className="flex items-center gap-3 w-full text-left p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                  <div className="flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 w-10 h-10">
                    <span className="material-symbols-outlined">logout</span>
                  </div>
                  <span className="font-medium text-red-500 dark:text-red-400">Log Out</span>
                </button>
              </div>
              <div className="mt-8 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-600">Version 2.4.0</p>
              </div>
            </div>

            <div>
              <h3 className="text-[#121014] dark:text-white text-lg font-bold mb-3 px-1">Linked Devices</h3>
              <p className="text-xs text-gray-500 mb-4 px-1">These devices can read your encrypted messages.</p>
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-soft transition-colors">
                {devices.map((device) => (
                  <div key={device.device_id} className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 last:border-0">
                     <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center rounded-xl ${device.device_id === deviceId ? 'bg-primary/20 text-primary' : 'bg-gray-50 dark:bg-white/5 text-gray-400'} w-10 h-10`}>
                          {device.device_name?.toLowerCase().includes('windows') || device.device_name?.toLowerCase().includes('mac') ? <Monitor size={20} /> : <Smartphone size={20} />}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#121014] dark:text-gray-200">{device.device_name || 'Unknown Device'}</span>
                            {device.device_id === deviceId && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-md font-bold uppercase tracking-wider">Current</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Clock size={10} />
                            <span>Active {new Date(device.last_active).toLocaleDateString()}</span>
                          </div>
                        </div>
                     </div>
                     {device.device_id !== deviceId && (
                       <button
                        onClick={() => unlinkDevice(device.device_id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                       >
                         <Trash2 size={18} />
                       </button>
                     )}
                  </div>
                ))}
                {devices.length === 0 && (
                  <div className="p-8 text-center text-gray-500 text-sm">No devices found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Report Modal */}
      <TodayReportModal
        isOpen={showTodayReport}
        onClose={() => setShowTodayReport(false)}
        todayLog={todayLog}
        cycleSettings={cycleSettings}
        profile={profile || {}}
      />

      <SyncHistoryModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </div>
  );
};

export default Settings;
