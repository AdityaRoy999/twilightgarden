import React from 'react';
import {useTheme} from '../../contexts/ThemeContext';

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
  const {showLoggingLabels=true}=useTheme();
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
    <div className="symptom-options" data-labels={showLoggingLabels}>
      {options.map(option => {
        const isSelected = selected.includes(option.id);
        return <button key={option.id} type="button" aria-pressed={isSelected} aria-label={option.label} title={showLoggingLabels?undefined:option.label} onClick={() => toggleSelection(option.id)} className="symptom-option"><span className="symptom-option-symbol" aria-hidden="true">{option.icon}</span>{showLoggingLabels&&<span>{option.label}</span>}</button>;
      })}
    </div>
  );
};
