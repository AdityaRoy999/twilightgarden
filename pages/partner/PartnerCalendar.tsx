import React from 'react';
import { useCouples } from '../../contexts/CouplesContext';
import { CalendarScreen } from '../Calendar';
import { ReferenceHeading } from '../../components/ui/ReferenceArt';
import { calculateCyclePhase } from '../../lib/cycleUtils';
import { localDateKey } from '../../lib/dates';

export default function PartnerCalendar() {
    const { couple, partnerData } = useCouples();
    if (!couple || !couple.share_enabled || couple.status!=='active') return <div className="reference-page"><ReferenceHeading title="Calendar"/><section className="reference-card"><h2 className="text-xl font-bold">{couple ? 'Calendar sharing is paused' : 'No partner connected'}</h2><p className="reference-description mt-3">{couple ? 'Your partner decides when to share their cycle calendar.' : 'Connect with your partner to see the dates they choose to share.'}</p></section></div>;
    const logs = partnerData?.logs || [];
    const cycleSettings = partnerData?.settings || {
        avg_cycle_length: 28,
        avg_period_length: 5,
        last_period_start: '',
    };

    const mappedSettings = {
        // Defensive mapping: check both camelCase (from context mapping) and snake_case (direct fallback)
        avgCycleLength: cycleSettings.avgCycleLength || cycleSettings.avg_cycle_length || 28,
        avgPeriodLength: cycleSettings.avgPeriodLength || cycleSettings.avg_period_length || 5,
        lastPeriodStart: cycleSettings.lastPeriodStart || cycleSettings.last_period_start || '',
        onboardingCompleted: true,
        irregularCycle: cycleSettings.irregularCycle || cycleSettings.irregular_cycle || false
    };

    // SMART FALLBACK: If lastPeriodStart is missing, derive it from logs
    if (!mappedSettings.lastPeriodStart && logs.length > 0) {
        const latestFlowLog = [...logs].sort((a,b) => b.date.localeCompare(a.date)).find((l: any) => l.is_period_start||l.periodStarted);
        if (latestFlowLog) {
            mappedSettings.lastPeriodStart = latestFlowLog.date;
        }
    }

    return <CalendarScreen logs={logs} cycleSettings={mappedSettings} getCyclePhase={(date = localDateKey()) => calculateCyclePhase(date, mappedSettings, logs)} readOnly description={`A little more in tune with ${partnerData?.profile?.full_name || 'your partner'}.`}/>;
}
