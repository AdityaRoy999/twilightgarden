import React, {  useRef } from 'react';

interface ModernSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
}

export const ModernSlider: React.FC<ModernSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full flex flex-col items-center gap-6 select-none touch-none">
       {/* Value Display */}
        <div className="flex flex-col items-center gap-1">
            <span className="text-[5rem] font-bold text-white leading-none tracking-tight">{value}</span>
            <span className="text-sm font-bold text-[#D14D72] uppercase tracking-[0.2em]">{unit || 'Days'}</span>
        </div>

      <div className="relative w-full h-12 flex items-center">
        {/* Track Background */}
        <div className="absolute w-full h-2 bg-surface-dark rounded-full overflow-hidden">
            {/* Active Track */}
            <div 
                className="h-full bg-gradient-to-r from-[#D14D72] to-[#FF8FA3] transition-all duration-100 ease-out"
                style={{ width: `${percentage}%` }}
            ></div>
        </div>

        {/* Input Range (Invisible but functional) */}
        <input 
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer z-20"
        />

        {/* Custom Thumb (Visual) */}
        <div 
            className="absolute size-8 bg-white rounded-full shadow-[0_0_15px_rgba(209,77,114,0.5)] border-4 border-[#121014] pointer-events-none transition-all duration-100 ease-out z-10 flex items-center justify-center transform -translate-x-1/2"
             style={{ left: `clamp(16px, ${percentage}%, calc(100% - 16px))` }}
        >
            <div className="w-1.5 h-1.5 bg-[#D14D72] rounded-full"></div>
        </div>
      </div>
        
    <div className="flex justify-between w-full text-xs font-medium text-gray-500 px-1">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
    </div>

    </div>
  );
};
