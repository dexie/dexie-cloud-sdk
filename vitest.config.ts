import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'examples/',
        'e2e/',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    },
  },
});
