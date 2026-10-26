import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Palette } from '../../components/ui/Icons';
import { useTheme } from '../../contexts/ThemeContext';
import { CustomColorPicker } from '../../components/ui/CustomColorPicker';
import { ReferenceArt, ReferenceHeading } from '../../components/ui/ReferenceArt';
import Toast from '../../components/Toast';

const presets = ['#c33367', '#f59ac2', '#e988ea', '#bb98f4', '#a69af4', '#97b0ff', '#9dcffa', '#87dce8', '#90eacb', '#ffcf85', '#ff9699', '#fa779d'];
export default function ThemeSettings() {
  const navigate = useNavigate();
  const { primaryColor, updatePrimaryColor, resetTheme } = useTheme();
  const [toast, setToast] = useState('');
  const reset = () => { resetTheme(); setToast('Theme reset'); };
  return <div className="reference-page reference-theme font-display">
    <ReferenceHeading title="App Theme" back onBack={() => navigate(-1)}/>
    <Toast message={toast} subMessage={toast === 'Theme reset' ? 'Back to the original colors' : 'Your accent color is ready'} type="success" isVisible={!!toast} onClose={() => setToast('')}/>
    <main className="reference-stack">
      <section className="reference-card reference-theme-preview"><ReferenceArt kind="leaves" className="reference-card-art"/><div><span className="reference-icon"><Palette size={26}/></span><div><h2>Twilight Garden</h2><p>Primary Color</p></div></div><div className="reference-theme-progress" aria-hidden="true"><span/></div><button className="reference-button" onClick={() => setToast('Looking good!')}>Sample Button</button></section>
      <section className="reference-card reference-color-card"><div><h2>Custom Color</h2><button onClick={reset}>Reset Default</button></div><CustomColorPicker color={primaryColor} onChange={updatePrimaryColor}/></section>
      <section className="reference-card reference-presets"><h2>Quick Presets</h2><div className="reference-presets-grid">{presets.map(color => <button key={color} aria-label={`Use color ${color}`} aria-pressed={primaryColor.toLowerCase() === color} onClick={() => updatePrimaryColor(color)} style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${color} 82%, white), ${color})`, color: color === '#c33367' ? 'white' : '#362c50' }}>{primaryColor.toLowerCase() === color && <Check size={24} strokeWidth={3}/>}</button>)}</div></section>
    </main>
  </div>;
}
