import { AppIcon } from '../components/ui/Icons';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useData } from '../contexts/DataContext';
import { ModernSlider } from '../components/ui/ModernSlider';

const CycleLengthSettings: React.FC = () => {
  const navigate = useNavigate();
  const { cycleSettings, updateSettings } = useData();
  const [length, setLength] = useState(cycleSettings.avgCycleLength);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const handleSave = async () => {
    if (saving) return;
    setSaving(true); setSaveError(null);
    try { await updateSettings({ avgCycleLength: length }); navigate(-1); }
    catch (err) { setSaveError(err instanceof Error ? err.message : 'Could not save changes. Please retry.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="animate-slideIn font-display flex flex-col min-h-screen bg-background-dark text-white pb-6 relative overflow-x-hidden">
      {/* Background Blobs */}
      <div className="fixed top-[-10%] right-[-10%] w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="fixed bottom-[10%] left-[-10%] w-[300px] h-[300px] bg-accent-teal/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-transparent">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <span className="app-icon-glyph text-white text-2xl"><AppIcon name={"arrow_back_ios_new"}/></span>
        </button>
        <h2 className="text-lg font-bold text-white">Cycle Settings</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 pt-4 flex flex-col items-center relative z-10">
        <div className="w-20 h-20 rounded-full bg-surface-dark border border-white/10 flex items-center justify-center shadow-lg mb-6">
           <span className="app-icon-glyph text-primary text-4xl"><AppIcon name={"cached"}/></span>
        </div>

        <h1 className="text-3xl font-bold mb-3 text-center text-white">Cycle Length</h1>
        <p className="text-gray-400 text-center text-sm leading-relaxed max-w-xs mb-12">
          The number of days between the first day of one period and the first day of the next.
        </p>

        {/* Picker */}
        <div className="w-full max-w-sm mb-12 px-4">
            <ModernSlider
                value={length}
                min={21}
                max={45}
                onChange={setLength}
                unit="Days"
            />
        </div>

        {/* Info Box */}
        <div className="bg-surface-dark/80 backdrop-blur-md rounded-2xl p-5 border border-white/5 w-full max-w-sm shadow-soft">
             <div className="flex gap-4">
                 <div className="shrink-0 pt-0.5">
                    <span className="app-icon-glyph text-yellow-500/80"><AppIcon name={"info"}/></span>
                 </div>
                 <div>
                     <h4 className="text-sm font-bold text-white mb-1">Normal Range</h4>
                     <p className="text-xs text-gray-400 leading-relaxed">
                         A typical cycle lasts between 21 and 35 days. If yours varies by more than 7-9 days, consider enabling "Irregular Cycle" in settings.
                     </p>
                 </div>
             </div>
        </div>
      </main>

      <div className="px-6 pt-4 pb-8 z-20 mt-auto">
        {saveError && <p role="alert" className="mb-3 text-red-400">{saveError}</p>}
        <button
            onClick={handleSave}
            disabled={saving}
            className="on-brand w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        >
            {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default CycleLengthSettings;
