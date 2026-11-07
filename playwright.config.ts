import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'tests/e2e', timeout:60000, fullyParallel:false, workers:1,
  use: { baseURL:'http://127.0.0.1:3000', headless:true, channel:'msedge', permissions:['camera','microphone'], launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}, screenshot:'only-on-failure', trace:'retain-on-failure' },
  webServer:{command:'npm run dev:local',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:60000},
});
