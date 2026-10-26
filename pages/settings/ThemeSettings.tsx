import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { CustomColorPicker } from '../../components/ui/CustomColorPicker';
import Toast from '../../components/Toast';

const ThemeSettings: React.FC = () => {
  const navigate = useNavigate();
  const { primaryColor, updatePrimaryColor, resetTheme } = useTheme();
  
  // Local state for picker to allow smooth dragging without saving immediately?
  // Current context updates are fast enough usually, but let's stick to direct binding.
  const [toast, setToast] = useState<{ message: string; subMessage?: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const showToast = (message: string, subMessage?: string) => {
    setToast({ message, subMessage, type: 'success', isVisible: true });
  };

  const handleReset = () => {
      resetTheme();
      showToast('Theme Reset', 'Back to original colors');
  };
  
  const presets = [
    '#c33367', // Rose
    '#ec4899', // Hot Pink
    '#d946ef', // Fuchsia
    '#8b5cf6', // Violet
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#0ea5e9', // Sky
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
  ];

  return (
    <div className="animate-slideIn font-display flex flex-col min-h-screen bg-background-dark transition-colors duration-300 pb-24">
        <Toast 
            message={toast.message}
            subMessage={toast.subMessage}
            isVisible={toast.isVisible}
            type={toast.type}
            onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
        />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-8 pb-6">
            <button 
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full bg-white dark:bg-white/5 shadow-sm border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-primary transition-colors"
            >
                <span className="material-symbols-outlined font-bold">arrow_back</span>
            </button>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] dark:text-white">App Theme</h1>
        </div>

        <div className="px-6 flex-1 overflow-y-auto">
            
            {/* Live Preview Card */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Live Preview</h3>
                <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/5 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                         <div className="on-brand w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
                             <span className="material-symbols-outlined">palette</span>
                         </div>
                         <div>
                             <h4 className="font-bold text-lg dark:text-white">Twilight Garden</h4>
                             <p className="text-primary font-medium text-sm">Primary Color</p>
                         </div>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-2/3 rounded-full" />
                    </div>
                    <button className="on-brand w-full py-3 bg-primary text-white rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                        Sample Button
                    </button>
                </div>
            </div>

            {/* Custom Picker */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Custom Color</h3>
                    <button 
                         onClick={handleReset}
                         className="text-xs text-primary hover:underline font-medium"
                    >
                        Reset Default
                    </button>
                </div>
                
                <div className="bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-soft border border-gray-100 dark:border-white/5">
                    <CustomColorPicker 
                        color={primaryColor} 
                        onChange={updatePrimaryColor} 
                    />
                </div>
            </div>

            {/* Presets */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Presets</h3>
                <div className="grid grid-cols-5 gap-4 sm:gap-5">
                    {presets.map(color => (
                        <button
                            key={color}
                            onClick={() => updatePrimaryColor(color)}
                            className={`w-full aspect-square rounded-2xl transition-all flex items-center justify-center relative overflow-hidden group ${
                                primaryColor === color 
                                    ? 'ring-2 ring-offset-2 ring-offset-[#FDFCF8] dark:ring-offset-background-dark ring-primary shadow-lg scale-105 z-10' 
                                    : 'hover:scale-105 hover:z-10 hover:shadow-md'
                            }`}
                            style={{ backgroundColor: color }}
                        >
                            {primaryColor === color && (
                                <span className="material-symbols-outlined text-white text-lg drop-shadow-md animate-in zoom-in">check</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    </div>
  );
};

export default ThemeSettings;
