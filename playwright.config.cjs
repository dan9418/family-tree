const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e',
  use: {baseURL: 'http://127.0.0.1:5180', channel: 'chrome', headless: true},
  webServer: {command: 'npm run dev -- --port 5180 --strictPort', url: 'http://127.0.0.1:5180', reuseExistingServer: false}
});
