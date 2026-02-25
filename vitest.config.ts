import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Proxy tests require a running Caddy — configure base URL via env
    env: {
      PROXY_BASE: process.env.PROXY_BASE ?? 'http://localhost:3001',
    },
    // Split into two pools: unit tests (no network) and proxy tests (need Caddy up)
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,         // proxy requests can be slow
    hookTimeout: 30000,         // beforeAll fetches fresh Reddit URLs
  },
})
