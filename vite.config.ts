import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // generateSW: let workbox produce the SW — configured with zero caching.
      // Caching is handled entirely by Caddy's disk cache.
      strategies: 'generateSW',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [],   // No runtime caching
        globPatterns: [],     // No precaching of assets
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
    alias: { '@': path.resolve(__dirname, '.') },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // No dev proxy — Caddy handles all proxying (run: ./caddy-amd64 run --config Caddyfile.dev)
})
