import { execSync } from 'node:child_process';

/** Runs once before all tests: applies migrations to the test database. */
export default function setup() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  // Safety net: the tests delete all data, so never run them against a non-test database.
  if (!testDatabaseUrl || !testDatabaseUrl.includes('test')) {
    throw new Error('TEST_DATABASE_URL must be set and point to a test database (its name must contain "test").');
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'ignore',
  });
}
