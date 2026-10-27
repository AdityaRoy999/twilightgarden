import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] },
      build: {
        manifest: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-motion': ['framer-motion'],
                    'vendor-charts': ['recharts'],
                    'vendor-dates': ['date-fns'],
                    'vendor-pdf': ['html2canvas', 'jspdf'],
                    'vendor-capacitor': ['@capacitor/core', '@capacitor/app', '@capacitor/filesystem', '@capacitor/local-notifications', '@capacitor/push-notifications', '@capacitor/share', '@capacitor/splash-screen'],
                    'vendor-supabase': ['@supabase/supabase-js']
                }
            }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
