// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '@': resolve(__dirname, 'app')
    }
  },
  test: {
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // Integration tests hit the remote Supabase DB; default 5s can flake on latency.
    testTimeout: 30000,
    hookTimeout: 30000
  }
})
