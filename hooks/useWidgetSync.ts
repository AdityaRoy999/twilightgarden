import { useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useCouples } from '../contexts/CouplesContext';
import { calculateCyclePhase } from '../lib/cycleUtils';
import { localDateKey } from '../lib/dates';
import { Capacitor } from '@capacitor/core';

export const useWidgetSync = () => {
    const { user } = useAuth();
    const { logs, cycleSettings } = useData();
    const { partnerProfile, partnerData, notes } = useCouples();

    useEffect(() => {
        if (!user || !Capacitor.isNativePlatform()) return;

        const syncData = async () => {
            try {
                // Calculate cycle day
                const { currentDay: cycleDay, phase } = calculateCyclePhase(localDateKey(), cycleSettings);
                const lastNote = notes.at(-1);
                const partnerLog = partnerData.logs.find(log => log.date === localDateKey());

                const payload = {
                    partner: {
                        name: partnerProfile?.full_name || 'Partner',
                        mood: partnerLog?.moods?.[0] || null,
                        online: partnerProfile?.status === 'online'
                    },
                    cycle: {
                        day: cycleDay,
                        phase: phase,
                        maxDays: cycleSettings.avgCycleLength
                    },
                    note: {
                        content: lastNote?.content || 'No new notes.',
                        time: lastNote?.created_at || null
                    },
                    activity: {
                        streak: null
                    },
                    updatedAt: new Date().toISOString()
                };

                // Save to Capacitor Preferences (which maps to SharedPreferences on Android)
                // We use a specific key that the native side will watch
                await Preferences.set({
                    key: 'twilight_widget_payload',
                    value: JSON.stringify(payload)
                });

                console.log('[WidgetSync] Data synchronized for native widgets');
            } catch (e) {
                console.error('[WidgetSync] Failed to sync data', e);
            }
        };

        syncData();
    }, [user, logs, cycleSettings, partnerProfile, partnerData, notes]);
};
