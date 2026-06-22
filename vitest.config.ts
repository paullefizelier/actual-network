// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // Integration tests hit the remote Supabase DB; default 5s can flake on latency.
    testTimeout: 30000,
    hookTimeout: 30000
  }
})
