import { defineConfig } from 'vitest/config';

/**
 * Tests der Firestore-Sicherheitsregeln. Sie sprechen einen echten
 * Firestore-Emulator an und laufen deshalb getrennt von den Unit-Tests:
 *
 *   firebase emulators:exec --only firestore --project demo-2cars2georgia \
 *     "npm run test:rules"
 *
 * Node- statt jsdom-Umgebung, weil @firebase/rules-unit-testing die
 * Admin-artigen Node-APIs nutzt. Der Timeout liegt höher, da der erste
 * Zugriff die Regeln in den Emulator lädt.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Alle Regeltests teilen sich eine Emulator-Instanz; parallele Worker
    // würden sich beim Leeren der Datenbank gegenseitig die Daten wegräumen.
    fileParallelism: false
  }
});
