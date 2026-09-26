import { defineConfig } from 'vitest/config';

process.env.TZ = 'Asia/Seoul';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/db/**/*.test.ts'],
    maxWorkers: 2,
    testTimeout: 15000,
    hookTimeout: 30000,
    restoreMocks: true,
  },
});
