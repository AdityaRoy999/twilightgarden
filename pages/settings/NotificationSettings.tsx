import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { checkNotificationPermission, registerPushNotifications, cancelAllNotifications, initNotificationListeners } from '../../lib/notifications';
import { Capacitor } from '@capacitor/core';


const NotificationSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getCyclePhase } = useData();

  const [periodNotifications, setPeriodNotifications] = useState(true);
  const [reminderNotifications, setReminderNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    initNotificationListeners();
    checkPermission();
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const checkPermission = async () => {
    const granted = await checkNotificationPermission();
    setPermissionGranted(granted);
  };

  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('user_settings').select('period_notifications,reminder_notifications').eq('user_id',user.id).maybeSingle();
      if (error) throw error;
      setPeriodNotifications(data?.period_notifications ?? true);
      setReminderNotifications(data?.reminder_notifications ?? true);
      await cancelAllNotifications();
    } catch { setError('Could not load notification preferences. Please retry.'); }
    finally { setLoading(false); }
  };

  const handleRequestPermission = async () => {
    if (!user || isSaving) return;
    setIsSaving(true); setError(null);
    try {
      await registerPushNotifications(user.id, true);
      const granted = await checkNotificationPermission();
      setPermissionGranted(granted);
      if (granted) {
        const { error } = await supabase.from('user_settings').upsert({user_id:user.id,notifications_enabled:true,time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone});
        if (error) throw error;
      } else setError('Notification permission was not granted. You can enable it in your device settings.');
    } catch { setError('Could not register this device for notifications. Please retry.'); }
    finally { setIsSaving(false); }
  };

  const updateSetting = async (field: 'period_notifications' | 'reminder_notifications', value: boolean) => {
    if (!user || isSaving) return;
    setIsSaving(true); setError(null);
    try {
      const {error}=await supabase.from('user_settings').upsert({user_id:user.id,[field]:value,time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone});
      if(error)throw error;
      if(field==='period_notifications')setPeriodNotifications(value); else setReminderNotifications(value);
    } catch {setError('Your preference was not saved. Please retry.');}
    finally {setIsSaving(false);}
  };
  const togglePeriod = () => updateSetting('period_notifications',!periodNotifications);
  const toggleReminder = () => updateSetting('reminder_notifications',!reminderNotifications);

  const sendTestNotification = async () => {
    if(!permissionGranted){await handleRequestPermission();return;}
    try {
      if(Capacitor.isNativePlatform()){
        const { LocalNotifications }=await import('@capacitor/local-notifications');
        const permission=await LocalNotifications.requestPermissions();
        if(permission.display!=='granted')throw new Error('Permission denied');
        await LocalNotifications.schedule({notifications:[{id:999,title:'Twilight Garden',body:'Notifications are working.',schedule:{at:new Date(Date.now()+1000)}}]});
      }else{
        const registration=await navigator.serviceWorker.ready;
        await registration.showNotification('Twilight Garden',{body:'Notifications are working.',icon:'/twilight.png'});
      }
      setTestSent(true);setTimeout(()=>setTestSent(false),3000);
    }catch{setError('Could not show a test notification. Please check your device permissions.');}
  };

  return (
    <div className="animate-slideIn font-display flex flex-col pb-24 bg-background-dark min-h-screen transition-colors duration-300">
      <header className="flex items-center px-6 pt-8 pb-4 gap-4 bg-transparent">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-white/5"
        >
          <span className="material-symbols-outlined text-[var(--text-primary)] dark:text-white text-xl">arrow_back</span>
        </button>
        <h2 className="text-[var(--text-primary)] dark:text-white text-2xl font-bold leading-tight tracking-tight">Notifications</h2>
      </header>

      {error && <p role="alert" className="px-6 py-3 text-red-600">{error}</p>}
      <div className="px-6 mb-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Choose which notifications you'd like to receive. We'll send you gentle reminders to help you track your cycle.
        </p>

        {/* Permission Status */}
        {!permissionGranted && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-amber-500">notifications_off</span>
              <span className="font-medium text-amber-700 dark:text-amber-400">Notifications Disabled</span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-300 mb-3">
              Enable notifications to receive period predictions and daily reminders.
            </p>
            <button
              onClick={handleRequestPermission}
              className="w-full py-2 rounded-lg bg-amber-500 text-white font-semibold text-sm"
            >
              Enable Notifications
            </button>
          </div>
        )}

        {permissionGranted && (
          <div className="mb-6 p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-green-500">check_circle</span>
            <span className="text-sm text-green-700 dark:text-green-400">Notifications enabled</span>
          </div>
        )}

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-soft transition-colors">
          {/* Period Cycle Notifications */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-500/10 text-pink-500 w-10 h-10">
                <span className="material-symbols-outlined">cycle</span>
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-[var(--text-primary)] dark:text-gray-200">Period Predictions</span>
                <span className="text-xs text-gray-500">Get notified before your estimated period</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                className="sr-only peer"
                type="checkbox"
                checked={periodNotifications}
                onChange={togglePeriod}
                disabled={loading || isSaving || !permissionGranted}
              />
              <div className={`w-11 h-6 ${permissionGranted ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-300 dark:bg-gray-800'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary`}></div>
            </label>
          </div>

          {/* Daily Reminder Notifications */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-500 w-10 h-10">
                <span className="material-symbols-outlined">edit_note</span>
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-[var(--text-primary)] dark:text-gray-200">Daily Reminders</span>
                <span className="text-xs text-gray-500">Alerts at 9AM, 10AM, 12PM, 3PM, 6PM & 11PM</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                className="sr-only peer"
                type="checkbox"
                checked={reminderNotifications}
                onChange={toggleReminder}
                disabled={loading || isSaving || !permissionGranted}
              />
              <div className={`w-11 h-6 ${permissionGranted ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-300 dark:bg-gray-800'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary`}></div>
            </label>
          </div>
        </div>
      </div>

      {/* Test Notification */}
      <div className="px-6">
        <button
          className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
            testSent
              ? 'on-brand bg-green-500 text-white'
              : 'bg-primary/10 hover:bg-primary/20 text-primary'
          }`}
          onClick={sendTestNotification}
          disabled={testSent}
        >
          <span className="material-symbols-outlined text-sm">
            {testSent ? 'check' : 'send'}
          </span>
          {testSent ? 'Notification Sent!' : 'Send Test Notification'}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">
          You'll receive a test notification in 1 second
        </p>
      </div>
    </div>
  );
};

export default NotificationSettings;
