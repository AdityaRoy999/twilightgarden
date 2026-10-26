import { AppIcon } from '../../components/ui/Icons';
import React from 'react';
import { useCouples } from '../../contexts/CouplesContext';
import { useTheme } from '../../contexts/ThemeContext';
import PartnerInsightsView from '../../components/PartnerInsightsView';

const PartnerInsights: React.FC = () => {
  const { partnerData, couple } = useCouples();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { profile, settings, logs } = partnerData;

  return (
    <div className={`pb-24 pt-6 px-4 max-w-md md:max-w-5xl lg:max-w-7xl mx-auto min-h-screen transition-colors duration-300 bg-background-dark`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>
            Insights
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
             for {profile?.full_name || 'Partner'}
          </p>
        </div>
      </div>

      {couple?.share_enabled ? (
        <PartnerInsightsView 
          logs={logs} 
          cycleSettings={settings} 
          theme={theme}
        />
      ) : (
        <div className="text-center py-20 bg-white dark:bg-surface-dark rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10 mt-10">
          <span className="app-icon-glyph text-4xl text-gray-400 mb-4 block"><AppIcon name={"lock"}/></span>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Insights are hidden by partner</p>
          <p className="text-xs text-gray-400 mt-1">Ghost Mode is currently active.</p>
        </div>
      )}
    </div>
  );
};

export default PartnerInsights;
