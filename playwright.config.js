import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', fullyParallel:false, workers:1,
  use:{baseURL:'http://127.0.0.1:3100',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},
  webServer:{command:'PORT=3100 node server.js',url:'http://127.0.0.1:3100',reuseExistingServer:false},
  reporter:'list'
});
