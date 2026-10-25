import { useNotifications } from '../hooks/useNotifications';
import { localDateKey, parseDateKey } from '../lib/dates';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCouples } from './CouplesContext';
import { DailyLog, DailyLogInput, CycleSettings, CyclePhase, AppNotification } from '../types';
import { calculateCyclePhase } from '../lib/cycleUtils';
import { encryptData, decryptData } from '../lib/encryption';
import { useToday } from '../hooks/useToday';

interface DataContextType {
  logs: DailyLog[];
  cycleSettings: CycleSettings;
  loading: boolean;
  error: Error | null; // Added error state
  notifications: AppNotification[];
  markAsRead: (id: string) => Promise<void>;
  addLog: (log: DailyLogInput) => Promise<void>;
  getLog: (date: string) => DailyLog | undefined;
  updateSettings: (settings: Partial<CycleSettings>) => Promise<void>;
  getCyclePhase: (date?: string) => CyclePhase;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_SETTINGS: CycleSettings = {
  avgCycleLength: 28,
  avgPeriodLength: 5,
  lastPeriodStart: '',
  onboardingCompleted: false,
  irregularCycle: false
};

// Sync helper to get user ID before first render
const getSyncUserId = (): string | null => {
  try {
    const cached = localStorage.getItem('twilight-cached-user');
    if (cached) {
      const userData = JSON.parse(cached);
      return userData?.id || null;
    }
  } catch { return null; }
  return null;
};

// Cache helpers scoped by UserId
const getCachedSettings = (userId: string | null): CycleSettings => {
  if (!userId) return DEFAULT_SETTINGS;
  try {
    const cached = localStorage.getItem(`tw_settings_${userId}`);
    if (cached) return JSON.parse(cached);
  } catch { return DEFAULT_SETTINGS; }
  // Only fallback to legacy flag if no full settings exist
  try {
      const done = localStorage.getItem('tw_onboarding_done') === 'true';
      return done ? { ...DEFAULT_SETTINGS, onboardingCompleted: true } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
};

const getCachedLogs = (userId: string | null): DailyLog[] => {
  if (!userId) return [];
  try {
    const cached = localStorage.getItem(`tw_logs_${userId}`);
    if (cached) return JSON.parse(cached);
  } catch { return []; }
  return [];
};

const setCachedSettings = (userId: string | null, settings: CycleSettings) => {
  if (!userId) return;
  try { localStorage.setItem(`tw_settings_${userId}`, JSON.stringify(settings)); } catch { }
};

const setCachedLogs = (userId: string | null, logs: DailyLog[]) => {
  if (!userId) return;
  // Keep cache small (e.g. only last 90 days) if needed, but for now cache all since logs might be small
  try { localStorage.setItem(`tw_logs_${userId}`, JSON.stringify(logs)); } catch { }
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayKey = useToday();
  const { user, loading: authLoading, sessionVerified, profileRefreshed } = useAuth();
  const { broadcastUpdate, partnerPubKey, keyVersion } = useCouples();

  // Synchronous cache load prevents initial Dashboard "Day 1" flash
  const syncUserId = getSyncUserId();
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const userId = getSyncUserId();
    return getCachedLogs(userId);
  });
  const [cycleSettings, setCycleSettings] = useState<CycleSettings>(() => {
    const userId = getSyncUserId();
    return getCachedSettings(userId);
  });
  const notificationStore = useNotifications();
  const notifications: AppNotification[] = notificationStore.notifications.map(n => ({id:n.id,type:n.type,message:n.message,isRead:n.is_read,timestamp:n.created_at}));
  const markAsRead = notificationStore.markAsRead;

  // Instant Loading Strategy:
  // If we have cached data, start with loading=false.
  // EXCEPT for fresh users who haven't finished onboarding.
  const [loading, setLoading] = useState(() => {
    const userId = getSyncUserId();
    const cached = getCachedSettings(userId);
    const cachedLogs = getCachedLogs(userId);

    // Check if user is already cached as a partner
    const cachedUser = localStorage.getItem('twilight-cached-user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        if (parsed?.role === 'partner') return false;
      } catch {}
    }

    // If onboarding is completed AND we have at least some data, cache is "good enough" for instant display
    return !(cached.onboardingCompleted && (cached.lastPeriodStart || cachedLogs.length > 0));
  });
  const [error, setError] = useState<Error | null>(null);

    const mapLog = async (l: any): Promise<DailyLog> => {
      let data = { ...l };

      // Decrypt payload if it exists
      if (l.encrypted_payload && partnerPubKey) {
        try {
          const decrypted = await decryptData<any>(l.encrypted_payload, partnerPubKey);
          if (decrypted) {
            data = { ...data, ...decrypted };
          }
        } catch (decryptError) {
          console.warn('[DataContext] Failed to decrypt log payload, using raw data:', decryptError);
        }
      }

      return {
        ...data,
        energyLevel: data.energy_level || data.energyLevel,
        sleepQuality: data.sleep_quality || data.sleepQuality,
        sleepHours: data.sleep_hours ?? data.sleepHours
      };
    };

  // 1. Subscribe to own daily logs & settings (Real-time Sync)
  useEffect(() => {
    if (!user || !sessionVerified) return;

    const logsChannel = supabase
      .channel(`user_logs_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLog = await mapLog(payload.new);
            setLogs(prev => {
              const next = [newLog, ...prev.filter(l => l.date !== newLog.date)].sort((a,b) => b.date.localeCompare(a.date));
              setCachedLogs(user.id,next); return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedLog = await mapLog(payload.new);
            setLogs(prev => { const next=prev.map(l => l.date === updatedLog.date ? updatedLog : l); setCachedLogs(user.id,next); return next; });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setLogs(prev => { const next=prev.filter(l => l.id !== deletedId); setCachedLogs(user.id,next); return next; });
          }
        }
      )
      .subscribe();

    const settingsChannel = supabase
      .channel(`user_settings_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            let s = payload.new as any;

            if (s.encrypted_payload && partnerPubKey) {
              const decrypted = await decryptData<any>(s.encrypted_payload, partnerPubKey);
              if (decrypted) s = { ...s, ...decrypted };
            }

            setCycleSettings({
              avgCycleLength: s.avg_cycle_length || s.avgCycleLength || 28,
              avgPeriodLength: s.avg_period_length || s.avgPeriodLength || 5,
              lastPeriodStart: s.last_period_start || s.lastPeriodStart || '',
              onboardingCompleted: s.onboarding_completed ?? s.onboardingCompleted ?? false,
              irregularCycle: s.irregular_cycle ?? s.irregularCycle ?? false
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [user?.id, sessionVerified, partnerPubKey]);

  // 2. Load Data from Supabase & Subscribe to Notifications
  useEffect(() => {
    // Don't fetch until supabase session JWT is actually verified
    if (!sessionVerified) return;

    if (!user) {
      setLogs([]);
      setCycleSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    // Admin users don't need cycle data - skip fetching and set loading false
    if (user.role === 'admin') {
      setLogs([]);
      setCycleSettings({ ...DEFAULT_SETTINGS, onboardingCompleted: true });
      setLoading(false);
      return;
    }

    // Partner/supporter users don't track periods - bypass onboarding
    if (user.role === 'partner') {
      setLogs([]);
      setCycleSettings({ ...DEFAULT_SETTINGS, onboardingCompleted: true });
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      if (!sessionVerified || !user) return;

      // Important: Wait for profile to be refreshed before fetching period data
      // to ensure partners aren't misidentified as regular users on first load.
      if (!profileRefreshed && !user.role) {
        import.meta.env.DEV && console.log('[Data] Waiting for profile refresh before fetch...');
        return;
      }

      // Partner/supporter users don't track periods - bypass onboarding
      if (user.role === 'partner') {
        setLogs([]);
        setCycleSettings({ ...DEFAULT_SETTINGS, onboardingCompleted: true });
        setLoading(false);
        return;
      }

      // If cache is present, loading is already false — fetch silently in the background
      const hasCachedData = cycleSettings.onboardingCompleted && (cycleSettings.lastPeriodStart || logs.length > 0);
      if (!hasCachedData) {
        setLoading(true);
      }

      try {
        // Fetch independent log and settings queries together.
        const [logsResult, settingsResult] = await Promise.all([
          supabase
            .from('daily_logs')
            .select('id,date,flow,moods,symptoms,notes,energy_level,sleep_hours,sleep_quality,encrypted_payload,created_at')
            .eq('user_id', user.id),
          supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .single(),

        ]);

        // Process logs
        const { data: logsData, error: logsError } = logsResult;
        if (logsError) throw logsError;
        if (cancelled) return;
        if (logsData) {
          const mappedLogs = await Promise.all((logsData as any[]).map(l => mapLog(l)));
          if (cancelled) return;
          setLogs(mappedLogs);
          setCachedLogs(user.id, mappedLogs);
        }

        // Process settings
        const { data: settingsData, error: settingsError } = settingsResult;
        if (!settingsError && settingsData) {
          let s = settingsData as any;

          if (s.encrypted_payload && partnerPubKey) {
            const decrypted = await decryptData<any>(s.encrypted_payload, partnerPubKey);
            if (decrypted) s = { ...s, ...decrypted };
          }

          let effectiveStart = s.last_period_start || s.lastPeriodStart || '';
          if (!effectiveStart && logsData && logsData.length > 0) {
            const sortedLogs = [...(logsData as any[])].sort((a, b) => b.date.localeCompare(a.date));
            const latestFlowLog = sortedLogs.find(l => l.flow);
            if (latestFlowLog) effectiveStart = latestFlowLog.date;
          }

          const newSettings = {
            avgCycleLength: s.avg_cycle_length || s.avgCycleLength || 28,
            avgPeriodLength: s.avg_period_length || s.avgPeriodLength || 5,
            lastPeriodStart: effectiveStart,
            onboardingCompleted: s.onboarding_completed ?? s.onboardingCompleted ?? false,
            irregularCycle: s.irregular_cycle ?? s.irregularCycle ?? false
          };
          if (!cancelled) {
            setCycleSettings(newSettings);
            setCachedSettings(user.id, newSettings);
          }
        } else if (settingsError && settingsError.code === 'PGRST116') {
          if (!cancelled) setCycleSettings({ ...DEFAULT_SETTINGS, onboardingCompleted: false });
        }

        if (cancelled) return;

      } catch (err: any) {
        if (!cancelled) {
          console.error('Error fetching data:', err);
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => { cancelled = true; };
  }, [user?.id, user?.role, sessionVerified, profileRefreshed, keyVersion]);

  const addLog = async (newLog: DailyLogInput) => {
    if (!user) throw new Error('Please sign in before saving a log.');
    const existingIndex = logs.findIndex(log => log.date === newLog.date);

    if (Number.isNaN(parseDateKey(newLog.date).getTime())) throw new Error('Choose a valid log date.');
    if ((newLog.notes?.length ?? 0) > 500) throw new Error('Notes must be 500 characters or fewer.');
    // Persist to Supabase
    try {
      const payload: Partial<DailyLog> = {
        flow: newLog.flow,
        moods: newLog.moods,
        symptoms: newLog.symptoms,
        notes: newLog.notes,
        energyLevel: newLog.energyLevel,
        sleepQuality: newLog.sleepQuality,
        sleepHours: newLog.sleepHours
      };

      let encryptedPayload = null;
      if (partnerPubKey) {
        encryptedPayload = await encryptData(payload, partnerPubKey);
      }

      const { data: savedLog, error } = await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date: newLog.date,
        // We still keep the original columns for basic filtering/indexing if needed,
        // but the 'encrypted_payload' is the source of truth now.
        flow: newLog.flow ?? null,
        moods: newLog.moods || [],
        symptoms: [...new Set(newLog.symptoms || [])],
        notes: newLog.notes || null,
        energy_level: newLog.energyLevel || null,
        sleep_quality: newLog.sleepQuality || null,
        sleep_hours: newLog.sleepHours ?? null,
        encrypted_payload: encryptedPayload
      } as any, { onConflict: 'user_id,date' }).select().single();

      if (error) throw error;
      const mappedLog = await mapLog(savedLog);
      setLogs(prev => {
        const next = [...prev.filter(l => l.date !== mappedLog.date), mappedLog].sort((a,b) => b.date.localeCompare(a.date));
        setCachedLogs(user.id, next);
        return next;
      });

      // Trigger Notification if it's a new log for today
      // Fire-and-forget: don't block the save on partner notification
      if (existingIndex === -1) {
        (async () => {
          try {
            const { data: couple } = await supabase
              .from('couples')
              .select('partner_1_id, partner_2_id')
              .or(`partner_1_id.eq.${user.id},partner_2_id.eq.${user.id}`)
              .eq('status', 'active')
              .single();

            const coupleData = couple as any;

            if (coupleData) {
              const partnerId = coupleData.partner_1_id === user.id ? coupleData.partner_2_id : coupleData.partner_1_id;

              if (partnerId) {
                const { data: partnerProfile } = await supabase
                  .from('profiles')
                  .select('partner_nickname')
                  .eq('id', partnerId)
                  .single();

                const nickname = (partnerProfile as any)?.partner_nickname || 'partner';
                const message = `Your ${nickname} has completed their daily log.`;

                let encryptedPayload = null;
                if (partnerPubKey) {
                  encryptedPayload = await encryptData({ message }, partnerPubKey);
                }

                await supabase.from('notifications').insert({
                  user_id: partnerId,
                  type: 'log',
                  message: '[Encrypted Message]',
                  encrypted_payload: encryptedPayload,
                  created_at: new Date().toISOString(),
                  is_read: false
                } as any);
              }
            }
          } catch (notifErr) {
            console.warn('Partner notification failed:', notifErr);
          }
        })();
      }

      // Trigger instant real-time sync for partner
      broadcastUpdate('log');
    } catch (err) {
      console.error("Failed to save log:", err);
      throw err;
    }
  };

  const getLog = (date: string) => logs.find(l => l.date === date);

  const updateSettings = async (updates: Partial<CycleSettings>) => {
    if (!user) throw new Error('Please sign in before saving settings.');
    const newSettings = { ...cycleSettings, ...updates };
    if (!Number.isFinite(newSettings.avgCycleLength) || newSettings.avgCycleLength < 20 || newSettings.avgCycleLength > 90 ||
        !Number.isFinite(newSettings.avgPeriodLength) || newSettings.avgPeriodLength < 1 || newSettings.avgPeriodLength > 20 || newSettings.avgPeriodLength >= newSettings.avgCycleLength) {
      throw new Error('Choose valid cycle and period lengths.');
    }
    if (user) {
      try {
        const payload = {
          avgCycleLength: newSettings.avgCycleLength,
          avgPeriodLength: newSettings.avgPeriodLength,
          lastPeriodStart: newSettings.lastPeriodStart,
          onboardingCompleted: newSettings.onboardingCompleted,
          irregularCycle: newSettings.irregularCycle
        };

        let encryptedPayload = null;
        if (partnerPubKey) {
          encryptedPayload = await encryptData(payload, partnerPubKey);
        }

        const { error } = await supabase.from('user_settings').upsert({
          user_id: user.id,
          avg_cycle_length: newSettings.avgCycleLength,
          avg_period_length: newSettings.avgPeriodLength,
          last_period_start: newSettings.lastPeriodStart || null,
          onboarding_completed: newSettings.onboardingCompleted,
          irregular_cycle: newSettings.irregularCycle,
          encrypted_payload: encryptedPayload
        } as any);
        if (error) throw error;

        setCycleSettings(newSettings);
        setCachedSettings(user.id, newSettings);
        broadcastUpdate('settings');
      } catch (err) {
        console.error("Failed to save settings:", err);
        throw err;
      }
    }
  };



  const getCyclePhase = (dateStr: string = todayKey): CyclePhase => {
    return calculateCyclePhase(dateStr, cycleSettings);
  };


  return (
    <DataContext.Provider value={{ logs, cycleSettings, loading, error, notifications, markAsRead, addLog, getLog, updateSettings, getCyclePhase }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
