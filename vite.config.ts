import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';
import { appCheckBuildError, appCheckOptional } from './src/lib/appCheckConfig';

export default defineConfig(({ command }) => ({
  // Version für die Anzeige in den Einstellungen – hilft beim Einordnen,
  // welcher Stand auf einem Gerät tatsächlich installiert ist.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    /**
     * Kein Produktions-Build ohne App Check.
     *
     * Der Site-Key war bisher optional – fehlte er, lief der Build durch und
     * die App ging ohne Bot-Schutz online, ohne dass irgendwo etwas davon
     * stand. Ein vergessener Schlüssel soll nicht wie ein normaler Build
     * aussehen, deshalb bricht er hier ab (siehe lib/appCheckConfig.ts).
     * `vite dev` bleibt unberührt: lokal gibt es nichts zu schützen.
     */
    {
      name: 'require-app-check',
      config() {
        if (command !== 'build') return;
        // process.env deckt CI und Deploy-Umgebungen ab, loadEnv die lokale
        // .env – gebaut wird mit beidem.
        const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
        if (appCheckOptional(env)) return;
        const error = appCheckBuildError(env);
        if (error) throw new Error(error);
      }
    },
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
}));
