import {showTestNotification} from '../../lib/notificationTest';
import { ReferenceArt, ReferenceHeading } from '../../components/ui/ReferenceArt';
import { PreferenceSwitch } from '../../components/ui/PreferenceSwitch';
import { BellOff, BellRing, CalendarDays, Send, Check } from '../../components/ui/Icons';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { requestNotificationPermission, checkNotificationPermission, registerPushNotifications, initNotificationListeners } from '../../lib/notifications';
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

    } catch { setError('Could not load notification preferences. Please retry.'); }
    finally { setLoading(false); }
  };

  const handleRequestPermission = async () => {
    if (!user || isSaving) return;
    setIsSaving(true); setError(null);
    try {
      if(!await requestNotificationPermission())throw new Error('Permission denied');
      await registerPushNotifications(user.id, true);
      const granted = await checkNotificationPermission();
      setPermissionGranted(granted);
      if (granted) {
        const { error } = await supabase.from('user_settings').upsert({user_id:user.id,notifications_enabled:true,time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone});
        if (error) throw error;
        window.dispatchEvent(new Event('twilight-private-preferences'));
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
      window.dispatchEvent(new Event('twilight-private-preferences'));
      if(field==='period_notifications')setPeriodNotifications(value); else setReminderNotifications(value);
    } catch {setError('Your preference was not saved. Please retry.');}
    finally {setIsSaving(false);}
  };
  const togglePeriod = () => updateSetting('period_notifications',!periodNotifications);
  const toggleReminder = () => updateSetting('reminder_notifications',!reminderNotifications);

  const sendTestNotification = async () => {
    if(!permissionGranted){await handleRequestPermission();return;}
    try {
      await showTestNotification();
      setTestSent(true);setTimeout(()=>setTestSent(false),3000);
    }catch{setError('Could not show a test notification. Please check your device permissions.');}
  };

  return <div className="reference-page reference-notifications font-display">
    <ReferenceHeading title="Notifications" back onBack={() => navigate(-1)} description="Choose which notifications you’d like to receive. We’ll send you gentle reminders to help you track your cycle."/>
    {Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios'&&<p className="mb-4 text-sm text-[var(--text-secondary)]">Health reminders are scheduled privately on this device for the next seven days and refreshed when you use the app. This iOS test build supports in-app alerts; closed-app remote push requires APNs and is not enabled in this build.</p>}
    {error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <main className="reference-stack">
      {!permissionGranted ? <section className="reference-card reference-notification-permission"><ReferenceArt kind="leaves" className="reference-card-art"/><div><span className="reference-icon"><BellOff size={27}/></span><div><h2>Notifications Disabled</h2><p className="reference-description">Enable notifications to receive period predictions and daily reminders.</p></div></div><button className="reference-button" onClick={handleRequestPermission} disabled={isSaving}>{isSaving ? 'Enabling…' : 'Enable Notifications'}</button></section> : <section className="reference-card flex items-center gap-3"><span className="reference-icon"><Check size={25}/></span><div><h2 className="font-bold">Notifications enabled</h2><p className="reference-description">A little nudge, when you need it.</p></div></section>}
      <section className="reference-card reference-preferences">
        <h2 className="pt-5 text-xl font-bold">Notification Preferences</h2>
        <div className="reference-setting-row"><div><span className="reference-icon"><CalendarDays size={25}/></span><span><strong>Period Predictions</strong><small>Get notified before your estimated period.</small></span></div><PreferenceSwitch label="Period Predictions" checked={periodNotifications} onChange={togglePeriod} disabled={loading || isSaving || !permissionGranted}/></div>
        <div className="reference-setting-row"><div><span className="reference-icon"><BellRing size={25}/></span><span><strong>Daily Reminders</strong><small>Gentle check-ins throughout your day.</small></span></div><PreferenceSwitch label="Daily Reminders" checked={reminderNotifications} onChange={toggleReminder} disabled={loading || isSaving || !permissionGranted}/></div>
      </section>
      <section className="reference-card reference-notification-test"><button className="reference-button secondary" onClick={sendTestNotification} disabled={testSent || isSaving}>{testSent ? <Check size={21}/> : <Send size={21}/>} {testSent ? 'Notification Sent!' : 'Send Test Notification'}</button><p>We’ll send a quick test to this device.</p></section>
    </main>
  </div>;
};
export default NotificationSettings;
