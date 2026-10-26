import { AppIcon } from './Icons';
import React from 'react';

export interface SymptomOption {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SymptomSelectorProps {
  options: SymptomOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiSelect?: boolean;
}

export const SymptomSelector: React.FC<SymptomSelectorProps> = ({ 
  options, 
  selected, 
  onChange, 
  multiSelect = true 
}) => {
  const toggleSelection = (id: string) => {
    if (multiSelect) {
      if (selected.includes(id)) {
        onChange(selected.filter((item) => item !== id));
      } else {
        onChange([...selected, id]);
      }
    } else {
      onChange([id]);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-y-6 gap-x-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggleSelection(option.id)}
            className="flex flex-col items-center gap-2 group"
          >
            <div
              className={`size-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isSelected
                  ? 'bg-primary/15 text-primary ring-2 ring-primary/40 scale-105'
                  : 'bg-primary/5 text-gray-500 hover:bg-primary/10'
              }`}
            >
              <div className={`text-[26px] ${
                  isSelected ? 'app-icon-glyph' : 'app-icon-glyph'
                }`}><AppIcon name={option.icon}/></div>
            </div>
            <span
              className={`text-[11px] font-medium transition-colors ${
                isSelected ? 'text-white' : 'text-gray-500'
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
