// Local-only visual fixture. No accounts, consent writes, or private data.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,useTheme} from '../../contexts/ThemeContext';
import {CycleDial} from '../../components/ui/CycleDial';
import {OnboardingArt,OnboardingBotanicals} from '../../components/ui/OnboardingArt';
import {AppIcon} from '../../components/ui/Icons';
import '../../index.css';import '../../styles/bloom.css';import '../../styles/reference.css';import '../../styles/spring.css';import '../../styles/dark.css';import '../../styles/refinements.css';import '../../styles/polish.css';import '../../styles/solar-polish.css';import '../../styles/gentle.css';import '../../styles/finish.css';
function Studio(){const [days,setDays]=useState(29),[step,setStep]=useState(0),{toggleTheme}=useTheme();return <main className="onboarding-garden safe-screen"><OnboardingBotanicals/><header className="onboarding-top"><button aria-label="Change theme" onClick={toggleTheme}><AppIcon name="light_mode" size={24}/></button><span>YOUR RHYTHM, YOUR PACE</span></header><div className="onboarding-stage"><OnboardingArt variant={step?'cycle':'welcome'}/><h1>{step?'How long is your cycle?':'Welcome'}</h1><p className="onboarding-intro">{step?'Choose your usual cycle length. An estimate is okay.':'A little care starts with understanding your rhythm. Add your cycle history to get started.'}</p>{step>0&&<CycleDial label="Cycle length" value={days} min={20} max={45} onChange={setDays}/>}<button className="reference-button onboarding-continue" onClick={()=>setStep(1)}>{step?'Continue':"Let's Start"}<AppIcon name="arrow_forward" size={23}/></button><div className="onboarding-progress"><span className="is-complete"/><span/><span/><p>{step?'2 of 3':'A little more in tune with you'}</p></div></div></main>;}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Studio/></ThemeProvider>);
