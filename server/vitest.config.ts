import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Loads TEST_DATABASE_URL (and anything else local) from server/.env.
dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
    },
  },
});
