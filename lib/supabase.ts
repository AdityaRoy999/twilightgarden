import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Singleton pattern to prevent multiple client instances
declare global {
  var __supabase: SupabaseClient<Database> | undefined;
}

import { CapacitorStorage } from './storageAdapter';

// Detect Tauri at module init time
const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);

function getSupabaseClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined' && window.__supabase) {
    return window.__supabase;
  }
  
  if (globalThis.__supabase) {
    return globalThis.__supabase;
  }

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: CapacitorStorage,
      persistSession: true,
      autoRefreshToken: true,
      // In Tauri the webview URL is tauri://localhost — Supabase's auto-detect
      // would never find tokens there and can clear a valid session. Disable it.
      detectSessionInUrl: !isTauri,
      flowType: 'pkce',
    },
    global: {
      // Token refresh runs before INITIAL_SESSION/getSession. Bound auth network
      // waits so an unavailable auth service cannot hold the client lock forever.
      fetch: (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!url.startsWith(`${supabaseUrl}/auth/v1/`)) return fetch(input, init);
        const inherited=init?.signal || (input instanceof Request ? input.signal : undefined);
        const timeout=AbortSignal.timeout(12000);
        return fetch(input,{...init,signal:inherited?AbortSignal.any([inherited,timeout]):timeout});
      },
      headers: {
        'X-Client-Info': 'twilight-app',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  // Store in globalThis for reuse
  globalThis.__supabase = client;
  
  // Also store in window for browser
  if (typeof window !== 'undefined') {
    (window as any).__supabase = client;
  }

  return client;
}

export const supabase = getSupabaseClient();
