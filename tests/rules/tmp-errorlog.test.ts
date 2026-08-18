import { readFileSync } from 'node:fs';
import { RulesTestEnvironment, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection } from 'firebase/firestore';
import { afterAll, beforeAll, it } from 'vitest';

let testEnv: RulesTestEnvironment;
const TRIP = 'sommertour-2026';
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-2cars2georgia',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});
afterAll(() => testEnv.cleanup());

it('errorLog-Dokument', async () => {
  const db = testEnv.authenticatedContext(`uid-${TRIP}`, { email: `${TRIP}@2cars2georgia.trip` }).firestore();
  await assertSucceeds(addDoc(collection(db, `roadtrips/${TRIP}/errors`), {
    timestamp: Date.now(),
    message: 'Kaputt',
    stack: 'Error: Kaputt\n at foo',
    context: 'react',
    author: 'Lukas',
    appVersion: '1.1.0',
    userAgent: 'Mozilla/5.0',
    url: 'https://example.test/stats'
  }));
});
