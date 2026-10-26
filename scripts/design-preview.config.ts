import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: { include: ['scripts/render-design-preview.tsx'], environment: 'jsdom', testTimeout: 60000 } });
