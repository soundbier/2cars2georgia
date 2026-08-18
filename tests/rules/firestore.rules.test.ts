import { readFileSync } from 'node:fs';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Tests der Firestore-Sicherheitsregeln gegen den echten Emulator.
 *
 * Diese Regeln sind die einzige tatsächliche Zugriffskontrolle der App – die
 * Firebase-Config liegt im Client, jeder könnte also direkt gegen Firestore
 * sprechen. Ein Fehler hier ist kein UI-Bug, sondern ein offenes Scheunentor;
 * deshalb prüfen wir beide Richtungen: Was erlaubt sein muss, und was nicht.
 *
 * Ausführen:
 *   npm run test:rules:emulator
 */

const TRIP = 'sommertour-2026';
const OTHER_TRIP = 'fremde-tour';

let testEnv: RulesTestEnvironment;

/** Firestore-Handle eines am Roadtrip angemeldeten Geräts. */
function tripDb(tripId: string) {
  return testEnv.authenticatedContext(`uid-${tripId}`, {
    email: `${tripId}@2cars2georgia.trip`,
    email_verified: false
  }).firestore();
}

function anonymousDb() {
  return testEnv.unauthenticatedContext().firestore();
}

const NOW = 1_770_000_000_000;

const validTrackPoint = {
  timestamp: NOW,
  author: 'Lukas',
  lat: 52.52,
  lng: 13.405,
  speedKmh: 12.4,
  headingDeg: 87
};

const validEvent = {
  timestamp: NOW,
  author: 'Lukas',
  type: 'schleuse',
  title: 'Schleuse Spandau',
  lat: 52.52,
  lng: 13.405
};

const validExpense = {
  timestamp: NOW,
  author: 'Leon',
  paidBy: 'Leon',
  title: 'Diesel',
  amountEuro: 84.5,
  category: 'tanken'
};

const validError = {
  timestamp: NOW,
  message: 'TypeError: undefined is not a function'
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-2cars2georgia',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

/** Legt Testdaten unter Umgehung der Regeln an (Ausgangszustand, kein Prüfobjekt). */
async function seed(path: string, value: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), value);
  });
}

describe('Roadtrip-Abschottung', () => {
  it('verweigert nicht angemeldeten Geräten jeden Zugriff', async () => {
    await seed(`roadtrips/${TRIP}/events/e1`, validEvent);
    const db = anonymousDb();

    await assertFails(getDoc(doc(db, `roadtrips/${TRIP}`)));
    await assertFails(getDoc(doc(db, `roadtrips/${TRIP}/events/e1`)));
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}/events/e2`), validEvent));
  });

  it('lässt ein angemeldetes Gerät nicht in einen fremden Roadtrip sehen', async () => {
    await seed(`roadtrips/${OTHER_TRIP}/events/e1`, validEvent);
    const db = tripDb(TRIP);

    await assertFails(getDoc(doc(db, `roadtrips/${OTHER_TRIP}`)));
    await assertFails(getDoc(doc(db, `roadtrips/${OTHER_TRIP}/events/e1`)));
    await assertFails(setDoc(doc(db, `roadtrips/${OTHER_TRIP}/events/e2`), validEvent));
    await assertFails(deleteDoc(doc(db, `roadtrips/${OTHER_TRIP}/events/e1`)));
  });

  it('erlaubt Lesen und Schreiben im eigenen Roadtrip', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026' });
    const db = tripDb(TRIP);

    await assertSucceeds(getDoc(doc(db, `roadtrips/${TRIP}`)));
    await assertSucceeds(setDoc(doc(db, `roadtrips/${TRIP}/events/e1`), validEvent));
  });

  it('sperrt Collections, die keine eigene Regel haben', async () => {
    // Schutz gegen die frühere Sammelfreigabe: Eine neue Collection soll nicht
    // still mitfreigegeben sein, sondern eine bewusste Regeländerung brauchen.
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}/beliebig/x`), { a: 1 }));
  });

  it('sperrt die alten Top-Level-Collections', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, 'events/e1'), validEvent));
    await assertFails(setDoc(doc(db, 'track/p1'), validTrackPoint));
    await assertFails(getDoc(doc(db, 'settings/general')));
  });
});

describe('Roadtrip-Dokument', () => {
  it('erlaubt das Anlegen mit Name und Server-Zeitstempel', async () => {
    const db = tripDb(TRIP);
    await assertSucceeds(
      setDoc(doc(db, `roadtrips/${TRIP}`), { name: 'Sommertour 2026', createdAt: serverTimestamp() })
    );
  });

  it('verweigert das Anlegen unter fremder ID', async () => {
    const db = tripDb(TRIP);
    await assertFails(
      setDoc(doc(db, `roadtrips/${OTHER_TRIP}`), { name: 'Fremd', createdAt: serverTimestamp() })
    );
  });

  it('verweigert zusätzliche Felder', async () => {
    const db = tripDb(TRIP);
    await assertFails(
      setDoc(doc(db, `roadtrips/${TRIP}`), {
        name: 'Sommertour 2026',
        createdAt: serverTimestamp(),
        istAdmin: true
      })
    );
  });

  it('verweigert einen leeren oder übergroßen Namen', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}`), { name: '', createdAt: serverTimestamp() }));
    await assertFails(
      setDoc(doc(db, `roadtrips/${TRIP}`), { name: 'x'.repeat(81), createdAt: serverTimestamp() })
    );
  });

  it('verweigert einen selbst gesetzten Zeitstempel', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}`), { name: 'Tour', createdAt: NOW }));
  });

  it('verweigert Ändern und Löschen', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026' });
    const db = tripDb(TRIP);

    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}`), { name: 'Umbenannt', createdAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, `roadtrips/${TRIP}`)));
  });
});

describe('Trackpunkte', () => {
  const path = `roadtrips/${TRIP}/track/p1`;

  it('nimmt einen gültigen Punkt an', async () => {
    await assertSucceeds(setDoc(doc(tripDb(TRIP), path), validTrackPoint));
  });

  it('nimmt einen Punkt ohne bekannten Kurs an', async () => {
    await assertSucceeds(setDoc(doc(tripDb(TRIP), path), { ...validTrackPoint, headingDeg: null }));
  });

  it('weist unmögliche Koordinaten ab', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, lat: 91 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, lng: 181 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, lat: '52.52' }));
  });

  it('weist absurde Geschwindigkeiten ab', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, speedKmh: -1 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, speedKmh: 99999 }));
  });

  it('weist einen unplausiblen Zeitstempel ab', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, timestamp: 0 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, timestamp: '2026' }));
  });

  it('weist fehlende und unbekannte Felder ab', async () => {
    const db = tripDb(TRIP);
    const { speedKmh, ...ohneSpeed } = validTrackPoint;
    void speedKmh;
    await assertFails(setDoc(doc(db, path), ohneSpeed));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, payload: 'x'.repeat(5000) }));
  });

  it('weist einen übergroßen Autorennamen ab', async () => {
    await assertFails(
      setDoc(doc(tripDb(TRIP), path), { ...validTrackPoint, author: 'x'.repeat(61) })
    );
  });

  it('lässt Punkte nur anhängen, nicht ändern', async () => {
    await seed(path, validTrackPoint);
    // Trackpunkte sind die Rohaufzeichnung der Tour – nachträgliches Umschreiben
    // würde Strecke und Statistik unbemerkt verfälschen.
    await assertFails(setDoc(doc(tripDb(TRIP), path), { ...validTrackPoint, speedKmh: 200 }));
  });

  it('erlaubt das Löschen im eigenen Roadtrip', async () => {
    await seed(path, validTrackPoint);
    await assertSucceeds(deleteDoc(doc(tripDb(TRIP), path)));
  });
});

describe('Logbuch-Ereignisse', () => {
  const path = `roadtrips/${TRIP}/events/e1`;

  it('nimmt ein gültiges Ereignis mit und ohne Notiz an', async () => {
    const db = tripDb(TRIP);
    await assertSucceeds(setDoc(doc(db, path), validEvent));
    await assertSucceeds(setDoc(doc(db, path), { ...validEvent, note: 'Wartezeit 20 min' }));
  });

  it('weist einen leeren Titel ab', async () => {
    await assertFails(setDoc(doc(tripDb(TRIP), path), { ...validEvent, title: '' }));
  });

  it('weist überlange Texte ab', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validEvent, title: 'x'.repeat(121) }));
    await assertFails(setDoc(doc(db, path), { ...validEvent, note: 'x'.repeat(2001) }));
  });

  it('weist unbekannte Felder ab', async () => {
    await assertFails(setDoc(doc(tripDb(TRIP), path), { ...validEvent, extra: true }));
  });

  it('prüft auch beim Ändern das Ergebnis', async () => {
    await seed(path, validEvent);
    const db = tripDb(TRIP);
    await assertSucceeds(setDoc(doc(db, path), { ...validEvent, title: 'Schleuse Charlottenburg' }));
    await assertFails(setDoc(doc(db, path), { ...validEvent, lat: 999 }));
  });

  it('erlaubt das weiche Löschen über deletedAt', async () => {
    await seed(path, validEvent);
    await assertSucceeds(setDoc(doc(tripDb(TRIP), path), { ...validEvent, deletedAt: NOW }));
  });

  it('weist ein deletedAt ab, das kein plausibler Zeitstempel ist', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validEvent, deletedAt: 'gestern' }));
    await assertFails(setDoc(doc(db, path), { ...validEvent, deletedAt: 0 }));
  });

  it('erlaubt das Löschen', async () => {
    await seed(path, validEvent);
    await assertSucceeds(deleteDoc(doc(tripDb(TRIP), path)));
  });
});

describe('Ausgaben', () => {
  const path = `roadtrips/${TRIP}/expenses/x1`;

  it('nimmt eine gültige Ausgabe an', async () => {
    await assertSucceeds(setDoc(doc(tripDb(TRIP), path), validExpense));
  });

  it('weist negative und absurd hohe Beträge ab', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validExpense, amountEuro: -1 }));
    await assertFails(setDoc(doc(db, path), { ...validExpense, amountEuro: 1_000_001 }));
  });

  it('weist einen Betrag ab, der kein Zahlenwert ist', async () => {
    await assertFails(setDoc(doc(tripDb(TRIP), path), { ...validExpense, amountEuro: '84,50' }));
  });

  it('verlangt einen Zahler', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validExpense, paidBy: '' }));
    const { paidBy, ...ohneZahler } = validExpense;
    void paidBy;
    await assertFails(setDoc(doc(db, path), ohneZahler));
  });

  it('erlaubt das weiche Löschen über deletedAt', async () => {
    await seed(path, validExpense);
    const db = tripDb(TRIP);
    await assertSucceeds(setDoc(doc(db, path), { ...validExpense, deletedAt: NOW }));
    await assertFails(setDoc(doc(db, path), { ...validExpense, deletedAt: 0 }));
  });

  it('erlaubt Ändern und Löschen', async () => {
    await seed(path, validExpense);
    const db = tripDb(TRIP);
    await assertSucceeds(setDoc(doc(db, path), { ...validExpense, amountEuro: 90 }));
    await assertSucceeds(deleteDoc(doc(db, path)));
  });
});

describe('Einstellungen', () => {
  it('erlaubt Crew-Liste und Schnell-Logs', async () => {
    const db = tripDb(TRIP);
    await assertSucceeds(
      setDoc(doc(db, `roadtrips/${TRIP}/settings/general`), { users: ['Lukas', 'Leon'] })
    );
    await assertSucceeds(
      setDoc(doc(db, `roadtrips/${TRIP}/settings/quicklogs`), {
        items: [{ id: 'pause', label: 'Pause', iconName: 'coffee' }]
      })
    );
  });

  it('weist ein unbekanntes Einstellungs-Dokument ab', async () => {
    await assertFails(setDoc(doc(tripDb(TRIP), `roadtrips/${TRIP}/settings/geheim`), { a: 1 }));
  });

  it('weist das falsche Feld im richtigen Dokument ab', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}/settings/general`), { items: [] }));
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}/settings/quicklogs`), { users: [] }));
  });

  it('deckelt die Listenlänge', async () => {
    const zuVieleNamen = Array.from({ length: 51 }, (_, i) => `Crew ${i}`);
    await assertFails(
      setDoc(doc(tripDb(TRIP), `roadtrips/${TRIP}/settings/general`), { users: zuVieleNamen })
    );
  });

  it('verweigert das Löschen der Einstellungen', async () => {
    await seed(`roadtrips/${TRIP}/settings/general`, { users: ['Lukas'] });
    await assertFails(deleteDoc(doc(tripDb(TRIP), `roadtrips/${TRIP}/settings/general`)));
  });
});

describe('Fehlerprotokoll', () => {
  const path = `roadtrips/${TRIP}/errors/f1`;

  it('nimmt einen Eintrag mit und ohne Zusatzangaben an', async () => {
    const db = tripDb(TRIP);
    await assertSucceeds(setDoc(doc(db, path), validError));
    // Bewusst ein zweites Dokument: Ein erneutes setDoc auf denselben Pfad wäre
    // ein Update und damit regelwidrig (siehe Test weiter unten).
    await assertSucceeds(
      setDoc(doc(db, `roadtrips/${TRIP}/errors/f2`), {
        ...validError,
        stack: 'at Foo (bundle.js:1:1)',
        context: 'render',
        author: 'Lukas',
        appVersion: '0.1.0',
        userAgent: 'Mozilla/5.0',
        url: 'https://example.invalid/map'
      })
    );
  });

  it('verlangt eine Meldung', async () => {
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { timestamp: NOW }));
    await assertFails(setDoc(doc(db, path), { ...validError, message: '' }));
  });

  it('deckelt die Größe eines Eintrags', async () => {
    // Ohne Deckel wäre ausgerechnet der Fehlerkanal der bequemste Weg, die
    // Datenbank vollzuschreiben – er nimmt beliebigen Text entgegen.
    const db = tripDb(TRIP);
    await assertFails(setDoc(doc(db, path), { ...validError, message: 'x'.repeat(1001) }));
    await assertFails(setDoc(doc(db, path), { ...validError, stack: 'x'.repeat(4001) }));
  });

  it('lässt Einträge nicht nachträglich ändern', async () => {
    await seed(path, validError);
    await assertFails(setDoc(doc(tripDb(TRIP), path), { ...validError, message: 'harmlos' }));
  });

  it('bleibt für fremde Roadtrips unlesbar', async () => {
    await seed(`roadtrips/${OTHER_TRIP}/errors/f1`, validError);
    await assertFails(getDoc(doc(tripDb(TRIP), `roadtrips/${OTHER_TRIP}/errors/f1`)));
  });
});

describe('Regelwerk selbst', () => {
  it('nutzt keine rekursive Sammelfreigabe unterhalb eines Roadtrips', async () => {
    // Ergänzt den Verhaltenstest oben: Selbst wenn jemand versehentlich einen
    // `{document=**}`-Block wieder einführt, schlägt dieser Test an.
    const rules = readFileSync('firestore.rules', 'utf8');
    const wildcardBloecke = rules.match(/\{document=\*\*\}/g) ?? [];
    expect(wildcardBloecke).toHaveLength(0);
  });
});
