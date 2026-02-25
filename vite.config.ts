import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [],  // No SW caching — nginx handles all proxy caching
        globPatterns: [],    // No precaching of assets
        navigateFallback: null,
      },
      manifest: {
        name: 'Scorlller',
        short_name: 'Scorlller',
        description: 'TikTok-style Reddit media viewer',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    // In dev, forward proxy routes to the nginx container (docker compose up -d)
    proxy: {
      '/proxy': 'http://localhost:3001',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      PROXY_BASE: process.env.PROXY_BASE ?? 'http://localhost:3001',
    },
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
