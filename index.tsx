import './index.css';
import './styles/bloom.css';
import './styles/reference.css';
import './styles/spring.css';
import './styles/dark.css';
import './styles/refinements.css';
import './styles/polish.css';
import './styles/wellness.css';
import './styles/solar-polish.css';
import './styles/gentle.css';
import './styles/history.css';
import './styles/finish.css';
import './styles/games.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from './lib/supabase';
import {installChunkRecovery} from './lib/chunkRecovery';

installChunkRecovery();

// Native OAuth opens in a system browser and returns a PKCE authorization code.
const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
if (!isTauri) {
  CapacitorApp.addListener('appUrlOpen', async ({url}) => {
    try {
      const {completeNativeAuth}=await import('./lib/nativeAuthCallback');
      if(await completeNativeAuth(url,supabase.auth)) {
        const {Browser}=await import('@capacitor/browser');
        await Browser.close().catch(()=>{});
        window.location.hash=sessionStorage.getItem('twilight-partner-signup')?'#/partner/auth-callback':'#/';
      }
    } catch {
      alert('Could not finish sign-in. Please return to the login screen and retry.');
    }
  });
}

// Firebase Messaging SW is auto-registered by Firebase SDK when getToken() is called
// No manual registration needed

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
