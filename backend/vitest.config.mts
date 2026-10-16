import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Tests run against a separate database (TEST_DATABASE_URL) that is wiped between tests.
export default defineConfig({
  test: {
    globalSetup: './tests/globalSetup.ts',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      JWT_SECRET: 'test-secret',
    },
    // All test files share one database, so run them one after another.
    fileParallelism: false,
  },
});
