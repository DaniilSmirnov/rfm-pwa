import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{js,jsx}'],
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    coverage: {
      provider: 'v8',
      include: ['src/components/**/*.jsx', 'src/views/**/*.jsx', 'src/modals/**/*.jsx'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        perFile: true,
        lines: 70,
      },
    },
  },
});
