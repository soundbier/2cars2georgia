import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Die großen Fremdbibliotheken in eigene Dateien statt in ein
        // gemeinsames Bündel: Sie ändern sich fast nie, bleiben so über
        // Deploys hinweg im Browser-Cache liegen und müssen nach einem
        // Update nicht erneut über eine unterwegs schlechte Verbindung.
        // Leaflet wird zusätzlich erst geladen, wenn jemand die Karte
        // öffnet – siehe die lazy-Routen in src/App.tsx.
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/firestore',
            'firebase/auth',
            'firebase/app-check'
          ],
          leaflet: ['leaflet', 'react-leaflet', 'leaflet-rotate'],
          react: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
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
