import './index.css';
import './styles/bloom.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from './lib/supabase';
import {installChunkRecovery} from './lib/chunkRecovery';

installChunkRecovery();

// Listen for deep link callbacks (OAuth) — Capacitor only
// Tauri deep links are handled in App.tsx via @tauri-apps/plugin-deep-link
const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
if (!isTauri) {
CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
  console.log('Deep link received:', url);
  
  try {
    // Handle OAuth callback from Supabase
    // The URL can come in different formats:
    // 1. com.twilight.garden://#access_token=xxx&refresh_token=xxx
    // 2. com.twilight.garden://?access_token=xxx&refresh_token=xxx
    // 3. com.twilight.garden://callback#access_token=xxx
    
    let params: URLSearchParams | null = null;
    
    // Try hash fragment first (most common for OAuth)
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const hash = url.substring(hashIndex + 1);
      params = new URLSearchParams(hash);
    }
    
    // If no tokens in hash, try query string
    if (!params?.get('access_token')) {
      const queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        const query = url.substring(queryIndex + 1).split('#')[0];
        params = new URLSearchParams(query);
      }
    }
    
    if (params) {
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      
      console.log('Tokens found:', !!accessToken, !!refreshToken);
      
      if (accessToken && refreshToken) {
        // Set the session manually
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) {
          console.error('Error setting session:', error);
          alert('Login failed: ' + error.message);
        } else {
          console.log('Session set successfully, reloading...');
          // Use hash navigation to go to home
          window.location.hash = '#/';
          window.location.reload();
        }
      } else if (accessToken) {
        // Sometimes only access token is provided
        console.log('Only access token found, trying to refresh session');
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('Deep link error:', error);
  }
});
} // end if (!isTauri)

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
