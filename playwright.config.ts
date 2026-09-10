import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', timezoneId: 'Asia/Seoul', locale: 'ko-KR', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'small-phone', use: { browserName: 'chromium', viewport: { width: 320, height: 568 } } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://denturecare-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_test_fixture_only' },
  },
});
