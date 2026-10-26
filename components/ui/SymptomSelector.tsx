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
    <div className="symptom-options">
      {options.map(option => {
        const isSelected = selected.includes(option.id);
        return <button key={option.id} type="button" aria-pressed={isSelected} onClick={() => toggleSelection(option.id)} className="symptom-option"><span className="symptom-option-symbol"><AppIcon name={option.icon}/></span><span>{option.label}</span></button>;
      })}
    </div>
  );
};
