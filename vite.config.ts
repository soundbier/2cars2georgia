import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  // Version für die Anzeige in den Einstellungen – hilft beim Einordnen,
  // welcher Stand auf einem Gerät tatsächlich installiert ist.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' statt 'autoUpdate': Ein neuer Service Worker aktiviert sich
      // nicht mehr selbstständig im Hintergrund, sondern wartet, bis die
      // Crew den Update-Screen (src/UpdatePrompt.tsx) bestätigt. So wird
      // niemandem mitten in einer Eingabe der Boden unter den Füßen weggezogen.
      registerType: 'prompt',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '2cars2georgia',
        short_name: '2cars2georgia',
        description: 'Offline GPS & Event Tracker für 2cars2georgia',
        theme_color: '#0284c7',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        icons: []
      },
      workbox: {
        // Alte Precache-Einträge früherer Builds entfernen, damit nach einem
        // Deploy keine veralteten Assets liegen bleiben.
        cleanupOutdatedCaches: true,
        // Der FCM-Worker ist selbst ein Service Worker mit eigenem Scope
        // (siehe public/firebase-messaging-sw.js). Ihn mit zu precachen würde
        // eine alte Fassung festhalten, obwohl der Browser ihn ohnehin eigen-
        // ständig aktuell hält.
        globIgnores: ['**/firebase-messaging-sw.js'],
        // Der neue Service Worker übernimmt alle offenen Tabs, sobald er
        // aktiviert wird – aber erst NACH Bestätigung im Update-Screen
        // (bewusst kein skipWaiting hier, siehe registerType oben).
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 1500,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/tiles\.openseamap\.org\/seamark\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openseamap-tiles',
              expiration: {
                maxEntries: 1500,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
