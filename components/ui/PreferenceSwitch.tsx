import React from 'react';
export function PreferenceSwitch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return <label className="reference-switch"><input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={onChange} disabled={disabled}/><span aria-hidden="true"/></label>;
}
