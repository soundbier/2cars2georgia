import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Eigene Config statt `test` in vite.config.ts: Der PWA-Plugin dort erzeugt
 * beim Laden einen Service Worker samt Precache-Manifest – für Unit-Tests ist
 * das unnötiger Ballast.
 *
 * Die Regeltests gegen den Firestore-Emulator laufen bewusst nicht hier mit,
 * sondern über `npm run test:rules` (siehe vitest.rules.config.ts). Sie
 * brauchen einen laufenden Emulator und sollen `npm test` nicht davon
 * abhängig machen.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // functions/src ist mit drin, weil die reine Benachrichtigungslogik der
    // Cloud Functions (functions/src/notifications.ts) bewusst ohne
    // firebase-admin/-functions auskommt und deshalb hier mitlaufen kann,
    // statt einen zweiten Testlauf mit eigener Installation zu brauchen.
    include: ['src/**/*.test.{ts,tsx}', 'functions/src/**/*.test.ts'],
    css: false
  }
});
