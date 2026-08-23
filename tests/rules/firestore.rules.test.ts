import { readFileSync } from 'node:fs';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  serverTimestamp
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Tests der Firestore-Sicherheitsregeln gegen den echten Emulator.
 *
 * Diese Regeln sind die einzige tatsächliche Zugriffskontrolle der App – die
 * Firebase-Config liegt im Client, jeder könnte also direkt gegen Firestore
 * sprechen. Ein Fehler hier ist kein UI-Bug, sondern ein offenes Scheunentor;
 * deshalb prüfen wir beide Richtungen: Was erlaubt sein muss, und was nicht.
 *
 * Zugriffsmodell (siehe firestore.rules und src/lib/membership.ts): jede
 * Person hat eine echte Firebase-Auth-UID, Mitgliedschaft und Rolle stehen
 * unter roadtrips/{tripId}/members/{uid}.
 *
 * Ausführen:
 *   npm run test:rules:emulator
 */

const TRIP = 'sommertour-2026';
const OTHER_TRIP = 'fremde-tour';

const OWNER_UID = 'uid-owner';
const MEMBER_UID = 'uid-member';
const READONLY_UID = 'uid-readonly';
const OUTSIDER_UID = 'uid-outsider';
const ADMIN_UID = 'uid-platform-admin';

let testEnv: RulesTestEnvironment;

/**
 * Firestore-Handle einer angemeldeten Person mit der gegebenen UID.
 *
 * `email_verified` gehört zum echten Firebase-Token und ist hier
 * standardmäßig true – so sieht der Normalfall aus. Für die Prüfung des
 * unbestätigten Kontos siehe unverifiedDb().
 */
function userDb(uid: string) {
  return testEnv
    .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true })
    .firestore();
}

/** Frisch registriertes Konto, dessen E-Mail-Adresse noch nicht bestätigt ist. */
function unverifiedDb(uid: string) {
  return testEnv
    .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: false })
    .firestore();
}

const ownerDb = () => userDb(OWNER_UID);
const memberDb = () => userDb(MEMBER_UID);
const readonlyDb = () => userDb(READONLY_UID);
const outsiderDb = () => userDb(OUTSIDER_UID);
const adminDb = () => userDb(ADMIN_UID);

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

const validTrackSession = {
  name: 'Passau – Linz',
  startedAt: NOW,
  endedAt: NOW + 3_600_000,
  author: 'Lukas'
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

const validDish = {
  name: 'Rotes Thai-Curry',
  mealType: 'dinner',
  ingredients: [
    { name: 'Paprika', quantity: 4, unit: 'Stück' },
    { name: 'Kokosmilch', quantity: 1, unit: 'Dose' }
  ],
  author: 'Leon',
  timestamp: NOW
};

const validMealPlanEntry = {
  date: '2026-07-03',
  mealType: 'dinner',
  dishId: 'curry',
  author: 'Leon',
  timestamp: NOW
};

const validPlannedRoute = {
  name: 'Tag 3: Passau – Linz',
  date: '2026-07-03',
  waypoints: [
    { id: 'a', lat: 48.5667, lng: 13.4319 },
    { id: 'b', lat: 48.3069, lng: 14.2858 }
  ],
  author: 'Leon',
  updatedAt: NOW
};

const validInventoryItem = {
  name: 'Paprika',
  quantity: 4,
  unit: 'Stück',
  location: 'Bilge',
  author: 'Leon',
  timestamp: NOW
};

const validShoppingListExtra = {
  name: 'Gas',
  quantity: 1,
  unit: 'Flasche',
  checked: false,
  author: 'Leon',
  timestamp: NOW
};

const validShoppingListCheck = {
  checked: true,
  checkedBy: 'Leon',
  checkedAt: NOW
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

/**
 * Legt einen Roadtrip mit Owner-, Member- und Readonly-Mitgliedschaft an –
 * der Standard-Ausgangszustand für die meisten Tests hier.
 */
async function seedTripWithCrew(tripId: string) {
  await seed(`roadtrips/${tripId}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
  await seed(`roadtrips/${tripId}/members/${OWNER_UID}`, {
    displayName: 'Owner',
    role: 'owner',
    joinedAt: NOW
  });
  await seed(`roadtrips/${tripId}/members/${MEMBER_UID}`, {
    displayName: 'Member',
    role: 'member',
    joinedAt: NOW
  });
  await seed(`roadtrips/${tripId}/members/${READONLY_UID}`, {
    displayName: 'Readonly',
    role: 'readonly',
    joinedAt: NOW
  });
}

describe('Profile & eindeutige Anzeigenamen', () => {
  it('verweigert nicht angemeldeten Geräten jeden Zugriff auf Profile', async () => {
    const db = anonymousDb();
    await assertFails(
      setDoc(doc(db, `users/${OWNER_UID}`), { displayName: 'Owner', email: 'x@example.com', createdAt: NOW })
    );
    await assertFails(setDoc(doc(db, 'usernames/owner'), { uid: OWNER_UID, createdAt: NOW }));
  });

  it('legt users/{uid} nur für die eigene UID mit passender E-Mail und Server-Zeitstempel an', async () => {
    const db = ownerDb();
    await assertSucceeds(
      setDoc(doc(db, `users/${OWNER_UID}`), {
        displayName: 'Owner',
        email: `${OWNER_UID}@example.com`,
        createdAt: serverTimestamp()
      })
    );
    await assertFails(
      setDoc(doc(db, `users/${MEMBER_UID}`), {
        displayName: 'Fremd',
        email: 'x@example.com',
        createdAt: serverTimestamp()
      })
    );
  });

  it('verweigert eine E-Mail, die nicht zum Auth-Token passt', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER_UID}`), {
        displayName: 'Owner',
        email: 'jemand-anderes@example.com',
        createdAt: serverTimestamp()
      })
    );
  });

  it('verweigert das Ändern eines einmal angelegten Profils', async () => {
    await seed(`users/${OWNER_UID}`, { displayName: 'Owner', email: `${OWNER_UID}@example.com`, createdAt: NOW });
    await assertFails(
      setDoc(doc(ownerDb(), `users/${OWNER_UID}`), {
        displayName: 'Neu',
        email: `${OWNER_UID}@example.com`,
        createdAt: serverTimestamp()
      })
    );
  });

  it('reserviert einen Anzeigenamen nur für die eigene UID', async () => {
    await assertSucceeds(
      setDoc(doc(ownerDb(), 'usernames/owner'), { uid: OWNER_UID, createdAt: serverTimestamp() })
    );
    await assertFails(
      setDoc(doc(memberDb(), 'usernames/owner2'), { uid: OWNER_UID, createdAt: serverTimestamp() })
    );
  });

  it('verweigert das Überschreiben eines bereits reservierten Namens', async () => {
    await seed('usernames/leon', { uid: OWNER_UID, createdAt: NOW });
    await assertFails(setDoc(doc(memberDb(), 'usernames/leon'), { uid: MEMBER_UID, createdAt: serverTimestamp() }));
  });
});

describe('Roadtrip-Abschottung', () => {
  it('verweigert nicht angemeldeten Geräten jeden Zugriff', async () => {
    await seedTripWithCrew(TRIP);
    const db = anonymousDb();

    await assertFails(getDoc(doc(db, `roadtrips/${TRIP}`)));
    await assertFails(getDoc(doc(db, `roadtrips/${TRIP}/events/e1`)));
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}/events/e2`), validEvent));
  });

  it('lässt eine angemeldete, aber fremde Person nicht in den Roadtrip sehen', async () => {
    await seedTripWithCrew(TRIP);
    const db = outsiderDb();

    // Das Wurzeldokument selbst darf per get() gelesen werden (siehe
    // firestore.rules, "Henne-Ei-Problem" – createRoadtrip/joinRoadtrip
    // brauchen genau das, bevor eine Mitgliedschaft existiert). Alles
    // dahinter bleibt gesperrt.
    await assertSucceeds(getDoc(doc(db, `roadtrips/${TRIP}`)));
    await assertFails(getDoc(doc(db, `roadtrips/${TRIP}/events/e1`)));
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}/events/e2`), validEvent));
    await assertFails(deleteDoc(doc(db, `roadtrips/${TRIP}/events/e1`)));
  });

  it('erlaubt Lesen und Schreiben einem Mitglied', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();

    await assertSucceeds(getDoc(doc(db, `roadtrips/${TRIP}`)));
    await assertSucceeds(setDoc(doc(db, `roadtrips/${TRIP}/events/e1`), validEvent));
  });

  it('sperrt Collections, die keine eigene Regel haben', async () => {
    // Schutz gegen die frühere Sammelfreigabe: Eine neue Collection soll nicht
    // still mitfreigegeben sein, sondern eine bewusste Regeländerung brauchen.
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), `roadtrips/${TRIP}/beliebig/x`), { a: 1 }));
  });

  it('sperrt die alten Top-Level-Collections', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, 'events/e1'), validEvent));
    await assertFails(setDoc(doc(db, 'track/p1'), validTrackPoint));
    await assertFails(getDoc(doc(db, 'settings/general')));
  });
});

describe('Roadtrip-Dokument', () => {
  it('erlaubt das Anlegen mit Name, Owner und Server-Zeitstempel', async () => {
    await seed(`users/${OWNER_UID}`, { displayName: 'Owner', email: 'x@example.com', createdAt: NOW });
    const db = ownerDb();
    await assertSucceeds(
      setDoc(doc(db, `roadtrips/${TRIP}`), {
        name: 'Sommertour 2026',
        ownerUid: OWNER_UID,
        createdAt: serverTimestamp()
      })
    );
  });

  it('erlaubt einer fremden Person die Existenzprüfung vor Anlegen/Beitreten', async () => {
    // Reproduziert src/lib/membership.ts: findFreeTripId() prüft per get(),
    // ob eine Slug-ID schon vergeben ist, joinRoadtrip() prüft so die
    // Existenz der Ziel-ID – beides passiert, bevor die aufrufende Person
    // Mitglied ist.
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
    const snap = await assertSucceeds(getDoc(doc(outsiderDb(), `roadtrips/${TRIP}`)));
    expect(snap.exists()).toBe(true);

    const missing = await assertSucceeds(getDoc(doc(outsiderDb(), `roadtrips/unbekannte-id`)));
    expect(missing.exists()).toBe(false);
  });

  it('verweigert das Anlegen ohne bestätigte E-Mail-Adresse', async () => {
    await seed(`users/${OWNER_UID}`, { displayName: 'Owner', email: 'x@example.com', createdAt: NOW });
    await assertFails(
      setDoc(doc(unverifiedDb(OWNER_UID), `roadtrips/${TRIP}`), {
        name: 'Sommertour 2026',
        ownerUid: OWNER_UID,
        createdAt: serverTimestamp()
      })
    );
  });

  it('verweigert das Anlegen ohne vorhandenes Profil', async () => {
    const db = ownerDb();
    await assertFails(
      setDoc(doc(db, `roadtrips/${TRIP}`), {
        name: 'Sommertour 2026',
        ownerUid: OWNER_UID,
        createdAt: serverTimestamp()
      })
    );
  });

  it('verweigert einen ownerUid, der nicht der eigenen UID entspricht', async () => {
    await seed(`users/${OWNER_UID}`, { displayName: 'Owner', email: 'x@example.com', createdAt: NOW });
    await assertFails(
      setDoc(doc(ownerDb(), `roadtrips/${TRIP}`), {
        name: 'Sommertour 2026',
        ownerUid: MEMBER_UID,
        createdAt: serverTimestamp()
      })
    );
  });

  it('verweigert zusätzliche Felder', async () => {
    await seed(`users/${OWNER_UID}`, { displayName: 'Owner', email: 'x@example.com', createdAt: NOW });
    await assertFails(
      setDoc(doc(ownerDb(), `roadtrips/${TRIP}`), {
        name: 'Sommertour 2026',
        ownerUid: OWNER_UID,
        createdAt: serverTimestamp(),
        adminPassword: 'x'
      })
    );
  });

  it('verweigert einen leeren oder übergroßen Namen', async () => {
    await seed(`users/${OWNER_UID}`, { displayName: 'Owner', email: 'x@example.com', createdAt: NOW });
    const db = ownerDb();
    await assertFails(
      setDoc(doc(db, `roadtrips/${TRIP}`), { name: '', ownerUid: OWNER_UID, createdAt: serverTimestamp() })
    );
    await assertFails(
      setDoc(doc(db, `roadtrips/${TRIP}`), {
        name: 'x'.repeat(81),
        ownerUid: OWNER_UID,
        createdAt: serverTimestamp()
      })
    );
  });

  it('verweigert einen selbst gesetzten Zeitstempel', async () => {
    await seed(`users/${OWNER_UID}`, { displayName: 'Owner', email: 'x@example.com', createdAt: NOW });
    await assertFails(
      setDoc(doc(ownerDb(), `roadtrips/${TRIP}`), { name: 'Tour', ownerUid: OWNER_UID, createdAt: NOW })
    );
  });

  it('verweigert Ändern für alle Rollen', async () => {
    await seedTripWithCrew(TRIP);
    const rename = (db: ReturnType<typeof ownerDb>) =>
      setDoc(doc(db, `roadtrips/${TRIP}`), {
        name: 'Umbenannt',
        ownerUid: OWNER_UID,
        createdAt: serverTimestamp()
      });
    await assertFails(rename(ownerDb()));
    await assertFails(rename(memberDb()));
  });

  it('erlaubt das endgültige Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(deleteDoc(doc(memberDb(), `roadtrips/${TRIP}`)));
    await assertFails(deleteDoc(doc(readonlyDb(), `roadtrips/${TRIP}`)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), `roadtrips/${TRIP}`)));
  });

  it('erlaubt der anlegenden Person das Aufräumen eines Roadtrips ohne eigene Mitgliedschaft', async () => {
    // Simuliert einen fehlgeschlagenen zweiten Schritt in createRoadtrip()
    // (siehe src/lib/membership.ts): Der Roadtrip-Datensatz existiert, aber
    // die Owner-Mitgliedschaft wurde nie angelegt.
    await seed(`roadtrips/${TRIP}`, { name: 'Halb fertig', ownerUid: OWNER_UID, createdAt: NOW });
    await assertFails(deleteDoc(doc(memberDb(), `roadtrips/${TRIP}`)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), `roadtrips/${TRIP}`)));
  });
});

describe('Mitgliedschaften', () => {
  it('lässt eine angemeldete Person sich selbst als member eintragen', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
    await assertSucceeds(
      setDoc(doc(memberDb(), `roadtrips/${TRIP}/members/${MEMBER_UID}`), {
        displayName: 'Member',
        role: 'member',
        joinedAt: serverTimestamp()
      })
    );
  });

  it('verweigert den Beitritt, solange die E-Mail-Adresse nicht bestätigt ist', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
    await assertFails(
      setDoc(doc(unverifiedDb(MEMBER_UID), `roadtrips/${TRIP}/members/${MEMBER_UID}`), {
        displayName: 'Member',
        role: 'member',
        joinedAt: serverTimestamp()
      })
    );
  });

  it('lässt dieselbe Person nach bestätigter E-Mail-Adresse beitreten', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
    await assertSucceeds(
      setDoc(doc(memberDb(), `roadtrips/${TRIP}/members/${MEMBER_UID}`), {
        displayName: 'Member',
        role: 'member',
        joinedAt: serverTimestamp()
      })
    );
  });

  it('lässt ein bestehendes Mitglied ohne bestätigte Adresse unangetastet weiterarbeiten', async () => {
    // Konten aus der Zeit vor dieser Prüfung (etwa das Administrationskonto)
    // dürfen durch die neue Regel nicht ausgesperrt werden: Verlangt wird sie
    // nur beim Anlegen einer Mitgliedschaft, nicht beim Nutzen einer
    // bestehenden.
    await seedTripWithCrew(TRIP);
    const db = unverifiedDb(MEMBER_UID);
    await assertSucceeds(getDoc(doc(db, `roadtrips/${TRIP}/members/${OWNER_UID}`)));
    await assertSucceeds(setDoc(doc(db, `roadtrips/${TRIP}/track/p-alt`), validTrackPoint));
    await assertSucceeds(deleteDoc(doc(db, `roadtrips/${TRIP}/members/${MEMBER_UID}`)));
  });

  it('verweigert das Selbst-Eintragen als owner ohne ownerUid-Übereinstimmung', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
    await assertFails(
      setDoc(doc(memberDb(), `roadtrips/${TRIP}/members/${MEMBER_UID}`), {
        displayName: 'Member',
        role: 'owner',
        joinedAt: serverTimestamp()
      })
    );
  });

  it('erlaubt der anlegenden Person, sich selbst als owner einzutragen', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
    await assertSucceeds(
      setDoc(doc(ownerDb(), `roadtrips/${TRIP}/members/${OWNER_UID}`), {
        displayName: 'Owner',
        role: 'owner',
        joinedAt: serverTimestamp()
      })
    );
  });

  it('verweigert das Eintragen für eine andere UID', async () => {
    await seed(`roadtrips/${TRIP}`, { name: 'Sommertour 2026', ownerUid: OWNER_UID, createdAt: NOW });
    await assertFails(
      setDoc(doc(memberDb(), `roadtrips/${TRIP}/members/${OUTSIDER_UID}`), {
        displayName: 'Fremd',
        role: 'member',
        joinedAt: serverTimestamp()
      })
    );
  });

  it('erlaubt nur dem Owner, die Rolle eines Mitglieds zu ändern', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(updateDoc(doc(memberDb(), `roadtrips/${TRIP}/members/${READONLY_UID}`), { role: 'owner' }));
    await assertSucceeds(
      updateDoc(doc(ownerDb(), `roadtrips/${TRIP}/members/${READONLY_UID}`), { role: 'member' })
    );
  });

  it('verweigert das Ändern von Anzeigename oder Beitrittsdatum über ein Rollen-Update', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(
      updateDoc(doc(ownerDb(), `roadtrips/${TRIP}/members/${MEMBER_UID}`), { displayName: 'Umbenannt' })
    );
  });

  it('erlaubt dem Owner, jedes Mitglied zu entfernen', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(deleteDoc(doc(memberDb(), `roadtrips/${TRIP}/members/${READONLY_UID}`)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), `roadtrips/${TRIP}/members/${READONLY_UID}`)));
  });

  it('erlaubt jeder Person, sich selbst zu entfernen (Roadtrip verlassen)', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(deleteDoc(doc(memberDb(), `roadtrips/${TRIP}/members/${MEMBER_UID}`)));
  });

  it('lässt Nicht-Mitglieder die Mitgliederliste nicht lesen', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(getDoc(doc(outsiderDb(), `roadtrips/${TRIP}/members/${OWNER_UID}`)));
  });

  it('erlaubt einer fremden Person nur die eigene, noch nicht existierende Mitgliedschaft zu lesen', async () => {
    // Reproduziert joinRoadtrip(): bevor das Mitglieds-Dokument angelegt
    // wird, liest der Client per get(), ob es (durch einen früheren Versuch)
    // schon existiert.
    await seedTripWithCrew(TRIP);
    const snap = await assertSucceeds(getDoc(doc(outsiderDb(), `roadtrips/${TRIP}/members/${OUTSIDER_UID}`)));
    expect(snap.exists()).toBe(false);
  });
});

describe('Trackpunkte', () => {
  const path = `roadtrips/${TRIP}/track/p1`;

  it('nimmt einen gültigen Punkt von Owner und Member an, aber nicht von Readonly', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validTrackPoint));
    await assertFails(setDoc(doc(readonlyDb(), `${path}-2`), validTrackPoint));
  });

  it('nimmt einen Punkt ohne bekannten Kurs an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), { ...validTrackPoint, headingDeg: null }));
  });

  it('nimmt eine optionale authorId nur an, wenn sie der eigenen UID entspricht', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), { ...validTrackPoint, authorId: MEMBER_UID }));
    await assertFails(setDoc(doc(memberDb(), `${path}-2`), { ...validTrackPoint, authorId: OWNER_UID }));
  });

  it('nimmt die Zugehörigkeit zu einer benannten Aufzeichnung an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), { ...validTrackPoint, sessionId: 'session-1' }));
    // Punkte aus der Zeit vor den benannten Aufzeichnungen haben keine.
    await assertSucceeds(setDoc(doc(memberDb(), `${path}-2`), validTrackPoint));
    await assertFails(setDoc(doc(memberDb(), `${path}-3`), { ...validTrackPoint, sessionId: 'x'.repeat(65) }));
  });

  it('weist unmögliche Koordinaten ab', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, lat: 91 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, lng: 181 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, lat: '52.52' }));
  });

  it('weist absurde Geschwindigkeiten ab', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, speedKmh: -1 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, speedKmh: 99999 }));
  });

  it('weist einen unplausiblen Zeitstempel ab', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, timestamp: 0 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, timestamp: '2026' }));
  });

  it('weist fehlende und unbekannte Felder ab', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    const { speedKmh, ...ohneSpeed } = validTrackPoint;
    void speedKmh;
    await assertFails(setDoc(doc(db, path), ohneSpeed));
    await assertFails(setDoc(doc(db, path), { ...validTrackPoint, payload: 'x'.repeat(5000) }));
  });

  it('weist einen übergroßen Autorennamen ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validTrackPoint, author: 'x'.repeat(61) }));
  });

  it('lässt Punkte nur anhängen, nicht ändern', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackPoint);
    // Trackpunkte sind die Rohaufzeichnung der Tour – nachträgliches Umschreiben
    // würde Strecke und Statistik unbemerkt verfälschen.
    await assertFails(setDoc(doc(memberDb(), path), { ...validTrackPoint, speedKmh: 200 }));
  });

  it('lässt denselben Punkt wortgleich noch einmal schreiben', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackPoint);
    // Der Offline-Puffer (src/lib/trackBuffer.ts) kann einen Punkt nach einem
    // App-Neustart ein zweites Mal hochladen. Weil die Dokument-ID aus
    // Aufzeichnung und Zeitstempel abgeleitet ist, trifft er dasselbe
    // Dokument – und darf es, solange nichts anderes darin steht.
    await assertSucceeds(setDoc(doc(memberDb(), path), validTrackPoint));
  });

  it('lässt auch die wortgleiche Wiederholung nicht von Readonly zu', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackPoint);
    await assertFails(setDoc(doc(readonlyDb(), path), validTrackPoint));
  });

  it('erlaubt das endgültige Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackPoint);
    await assertFails(deleteDoc(doc(memberDb(), path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Benannte Aufzeichnungen', () => {
  const path = `roadtrips/${TRIP}/trackSessions/session-1`;

  it('nimmt eine gültige Aufzeichnung von Owner und Member an, aber nicht von Readonly', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validTrackSession));
    await assertFails(setDoc(doc(readonlyDb(), `${path}-2`), validTrackSession));
  });

  it('nimmt eine optionale authorId nur an, wenn sie der eigenen UID entspricht', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), { ...validTrackSession, authorId: MEMBER_UID }));
    await assertFails(setDoc(doc(memberDb(), `${path}-2`), { ...validTrackSession, authorId: OWNER_UID }));
  });

  it('verlangt einen nicht leeren, nicht überlangen Namen', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validTrackSession, name: '' }));
    await assertFails(setDoc(doc(db, path), { ...validTrackSession, name: 'x'.repeat(121) }));
  });

  it('weist ein Ende vor dem Start ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validTrackSession, endedAt: NOW - 1 }));
  });

  it('weist unplausible Zeitstempel und unbekannte Felder ab', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validTrackSession, startedAt: 0 }));
    await assertFails(setDoc(doc(db, path), { ...validTrackSession, distanceKm: 42 }));
  });

  it('erlaubt das Umbenennen', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackSession);
    // Der Name ist Beschriftung, keine Aufzeichnung – anders als die
    // Trackpunkte darf er sich nachträglich ändern.
    await assertSucceeds(setDoc(doc(memberDb(), path), { ...validTrackSession, name: 'Tag 1' }));
  });

  it('lässt auch die Fahrt einer anderen Person umbenennen', async () => {
    await seedTripWithCrew(TRIP);
    // Gefahren ist der Owner, richtiggestellt wird der Name vom Member: Die
    // authorId sagt, wer aufgezeichnet hat, nicht wer zuletzt getippt hat.
    await seed(path, { ...validTrackSession, authorId: OWNER_UID });
    await assertSucceeds(
      setDoc(doc(memberDb(), path), { ...validTrackSession, authorId: OWNER_UID, name: 'Tag 1' })
    );
  });

  it('lässt beim Umbenennen nichts als den Namen ändern', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackSession);
    const db = memberDb();
    // Start, Ende und Autor sind die Aufzeichnung selbst.
    await assertFails(
      setDoc(doc(db, path), { ...validTrackSession, name: 'Tag 1', startedAt: NOW - 60_000 })
    );
    await assertFails(
      setDoc(doc(db, path), { ...validTrackSession, name: 'Tag 1', author: 'Fremd' })
    );
    // Auch die authorId bleibt an der Person, die gefahren ist.
    await assertFails(
      setDoc(doc(db, path), { ...validTrackSession, name: 'Tag 1', authorId: MEMBER_UID })
    );
  });

  it('lässt die Fahrt in den Papierkorb legen und zurückholen', async () => {
    await seedTripWithCrew(TRIP);
    // Auch hier die Fahrt einer anderen Person: Wegräumen ist rückholbar.
    await seed(path, { ...validTrackSession, authorId: OWNER_UID });
    const db = memberDb();
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: deleteField() }));
  });

  it('weist einen unplausiblen Papierkorb-Zeitstempel ab', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackSession);
    await assertFails(updateDoc(doc(memberDb(), path), { deletedAt: 'gestern' }));
  });

  it('erlaubt das endgültige Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackSession);
    await assertFails(deleteDoc(doc(memberDb(), path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });

  it('bleibt für Außenstehende unsichtbar', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validTrackSession);
    await assertFails(getDoc(doc(outsiderDb(), path)));
  });
});

describe('Logbuch-Ereignisse', () => {
  const path = `roadtrips/${TRIP}/events/e1`;

  it('nimmt ein gültiges Ereignis mit und ohne Notiz an', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertSucceeds(setDoc(doc(db, path), validEvent));
    await assertSucceeds(setDoc(doc(db, path), { ...validEvent, note: 'Wartezeit 20 min' }));
  });

  it('verweigert Readonly das Anlegen', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(readonlyDb(), path), validEvent));
  });

  it('weist einen leeren Titel ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validEvent, title: '' }));
  });

  it('weist überlange Texte ab', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validEvent, title: 'x'.repeat(121) }));
    await assertFails(setDoc(doc(db, path), { ...validEvent, note: 'x'.repeat(2001) }));
  });

  it('weist unbekannte Felder ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validEvent, extra: true }));
  });

  it('prüft auch beim Ändern das Ergebnis', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validEvent);
    const db = memberDb();
    await assertSucceeds(setDoc(doc(db, path), { ...validEvent, title: 'Schleuse Charlottenburg' }));
    await assertFails(setDoc(doc(db, path), { ...validEvent, lat: 999 }));
  });

  it('erlaubt das weiche Löschen über deletedAt', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validEvent);
    await assertSucceeds(setDoc(doc(memberDb(), path), { ...validEvent, deletedAt: NOW }));
  });

  it('erlaubt das weiche Löschen als Teil-Update, so wie die App es schickt', async () => {
    // Die App schickt beim Löschen nur { deletedAt }, nicht das ganze Dokument –
    // die Regeln prüfen deshalb den zusammengeführten Stand.
    await seedTripWithCrew(TRIP);
    await seed(path, validEvent);
    const db = memberDb();
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: deleteField() }));
  });

  it('weist ein deletedAt ab, das kein plausibler Zeitstempel ist', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validEvent, deletedAt: 'gestern' }));
    await assertFails(setDoc(doc(db, path), { ...validEvent, deletedAt: 0 }));
  });

  it('erlaubt das endgültige Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validEvent);
    // Für die Crew führt der Weg über den Papierkorb (deletedAt), nicht über
    // das endgültige Entfernen.
    await assertFails(deleteDoc(doc(memberDb(), path)));
    await assertFails(deleteDoc(doc(readonlyDb(), path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Ausgaben', () => {
  const path = `roadtrips/${TRIP}/expenses/x1`;

  it('nimmt eine gültige Ausgabe an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validExpense));
  });

  it('weist negative und absurd hohe Beträge ab', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validExpense, amountEuro: -1 }));
    await assertFails(setDoc(doc(db, path), { ...validExpense, amountEuro: 1_000_001 }));
  });

  it('weist einen Betrag ab, der kein Zahlenwert ist', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validExpense, amountEuro: '84,50' }));
  });

  it('verlangt einen Zahler', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validExpense, paidBy: '' }));
    const { paidBy, ...ohneZahler } = validExpense;
    void paidBy;
    await assertFails(setDoc(doc(db, path), ohneZahler));
  });

  it('erlaubt das weiche Löschen über deletedAt', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validExpense);
    const db = memberDb();
    await assertSucceeds(setDoc(doc(db, path), { ...validExpense, deletedAt: NOW }));
    await assertFails(setDoc(doc(db, path), { ...validExpense, deletedAt: 0 }));
  });

  it('erlaubt das weiche Löschen als Teil-Update, so wie die App es schickt', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validExpense);
    const db = memberDb();
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: deleteField() }));
  });

  it('erlaubt Ändern der Crew, endgültiges Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validExpense);
    const db = memberDb();
    await assertSucceeds(setDoc(doc(db, path), { ...validExpense, amountEuro: 90 }));
    await assertFails(deleteDoc(doc(db, path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Gerichte', () => {
  const path = `roadtrips/${TRIP}/dishes/curry`;

  it('nimmt ein gültiges Gericht an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validDish));
  });

  it('weist eine unbekannte Mahlzeit ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validDish, mealType: 'brunch' }));
  });

  it('weist Zutaten ab, die keine Liste sind', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validDish, ingredients: 'viel' }));
  });

  it('deckelt die Zutatenliste', async () => {
    await seedTripWithCrew(TRIP);
    const zuVieleZutaten = Array.from({ length: 31 }, (_, i) => ({ name: `Zutat ${i}`, quantity: 1, unit: 'Stück' }));
    await assertFails(setDoc(doc(memberDb(), path), { ...validDish, ingredients: zuVieleZutaten }));
  });

  it('erlaubt das weiche Löschen, endgültiges Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validDish);
    const db = memberDb();
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertFails(deleteDoc(doc(db, path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Geplante Routen', () => {
  const path = `roadtrips/${TRIP}/plannedRoutes/tag-3`;

  it('nimmt eine gültige Route an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validPlannedRoute));
  });

  it('erlaubt eine Route ohne Namen und ohne Tag', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertSucceeds(setDoc(doc(db, path), { ...validPlannedRoute, name: '', date: '' }));
    const { name, date, ...ohneBeides } = validPlannedRoute;
    void name;
    void date;
    await assertSucceeds(setDoc(doc(db, path), ohneBeides));
  });

  it('weist ein Datum in falschem Format ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validPlannedRoute, date: '3.7.2026' }));
  });

  it('weist Wegpunkte ab, die keine Liste sind, und deckelt ihre Zahl', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validPlannedRoute, waypoints: 'viele' }));
    const zuViele = Array.from({ length: 501 }, (_, i) => ({ id: `p${i}`, lat: 48, lng: 13 }));
    await assertFails(setDoc(doc(db, path), { ...validPlannedRoute, waypoints: zuViele }));
  });

  it('lässt Nur-Lesen und Fremde nicht heran', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validPlannedRoute);
    await assertSucceeds(getDoc(doc(readonlyDb(), path)));
    await assertFails(setDoc(doc(readonlyDb(), path), validPlannedRoute));
    await assertFails(getDoc(doc(outsiderDb(), path)));
  });

  it('lässt die Crew ihre Planung in den Papierkorb legen und zurückholen', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validPlannedRoute);
    const db = memberDb();
    // Löschen heißt Papierkorb: eine abgesteckte Route ist Arbeit, und der
    // Knopf sitzt auf dem Telefon neben dem Stift.
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: deleteField() }));
  });

  it('weist einen unplausiblen Papierkorb-Zeitstempel ab', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validPlannedRoute);
    await assertFails(updateDoc(doc(memberDb(), path), { deletedAt: 'gestern' }));
  });

  it('erlaubt das endgültige Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validPlannedRoute);
    // Aus dem Papierkorb heraus – für die Crew ist der Weg dorthin gedacht.
    await assertFails(deleteDoc(doc(memberDb(), path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Speiseplan-Einträge', () => {
  const path = `roadtrips/${TRIP}/mealPlanEntries/e1`;

  it('nimmt einen gültigen Eintrag an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validMealPlanEntry));
  });

  it('weist ein Datum in falschem Format ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validMealPlanEntry, date: '3.7.2026' }));
  });

  it('weist eine unbekannte Mahlzeit ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validMealPlanEntry, mealType: 'brunch' }));
  });

  it('erlaubt das weiche Löschen, endgültiges Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validMealPlanEntry);
    const db = memberDb();
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertFails(deleteDoc(doc(db, path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Lager', () => {
  const path = `roadtrips/${TRIP}/inventory/i1`;

  it('nimmt einen gültigen Lagerposten an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validInventoryItem));
  });

  it('weist eine negative Menge ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validInventoryItem, quantity: -1 }));
  });

  it('erlaubt das Anpassen der Menge als Teil-Update, so wie es die App beim Kochen tut', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validInventoryItem);
    await assertSucceeds(updateDoc(doc(memberDb(), path), { quantity: 2 }));
  });

  it('erlaubt das weiche Löschen, endgültiges Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validInventoryItem);
    const db = memberDb();
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertFails(deleteDoc(doc(db, path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Einkaufsliste (manuell)', () => {
  const path = `roadtrips/${TRIP}/shoppingListExtras/s1`;

  it('nimmt einen gültigen manuellen Posten an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validShoppingListExtra));
  });

  it('verlangt, dass checked ein Wahrheitswert ist', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validShoppingListExtra, checked: 'ja' }));
  });

  it('erlaubt das Abhaken als Teil-Update', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validShoppingListExtra);
    await assertSucceeds(updateDoc(doc(memberDb(), path), { checked: true }));
  });

  it('erlaubt das weiche Löschen, endgültiges Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validShoppingListExtra);
    const db = memberDb();
    await assertSucceeds(updateDoc(doc(db, path), { deletedAt: NOW }));
    await assertFails(deleteDoc(doc(db, path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });
});

describe('Einkaufsliste (Abhaken berechneter Posten)', () => {
  const path = `roadtrips/${TRIP}/shoppingListChecks/paprika-stück`;

  it('nimmt einen gültigen Abhak-Status an', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validShoppingListCheck));
  });

  it('weist ein fehlendes Pflichtfeld ab', async () => {
    await seedTripWithCrew(TRIP);
    const { checkedBy, ...ohneCheckedBy } = validShoppingListCheck;
    void checkedBy;
    await assertFails(setDoc(doc(memberDb(), path), ohneCheckedBy));
  });

  it('erlaubt das Umschalten ohne Owner-Zugang', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validShoppingListCheck);
    await assertSucceeds(
      updateDoc(doc(memberDb(), path), { checked: false, checkedBy: 'Niklas', checkedAt: NOW })
    );
  });
});

describe('Einstellungen', () => {
  it('erlaubt Schnell-Logs der ganzen Crew, Reisezeitraum nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(
      setDoc(doc(ownerDb(), `roadtrips/${TRIP}/settings/general`), {
        startDate: '2026-07-01',
        endDate: '2026-07-14'
      })
    );
    await assertFails(
      setDoc(doc(memberDb(), `roadtrips/${TRIP}/settings/general`), {
        startDate: '2026-07-01',
        endDate: '2026-07-14'
      })
    );
    await assertSucceeds(
      setDoc(doc(memberDb(), `roadtrips/${TRIP}/settings/quicklogs`), {
        items: [{ id: 'pause', label: 'Pause', iconName: 'coffee' }]
      })
    );
  });

  it('weist ein unbekanntes Einstellungs-Dokument ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), `roadtrips/${TRIP}/settings/geheim`), { a: 1 }));
  });

  it('weist das falsche Feld im richtigen Dokument ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(ownerDb(), `roadtrips/${TRIP}/settings/general`), { items: [] }));
    await assertFails(setDoc(doc(memberDb(), `roadtrips/${TRIP}/settings/quicklogs`), { users: [] }));
  });

  it('lässt bestehende (Alt-)Felder users/roles weiterhin zu, ohne sie zu verlangen', async () => {
    // Bestehende Roadtrips tragen users/roles noch in settings/general (vor
    // der Umstellung auf members/). Die Feldprüfung darf daran nicht scheitern.
    await seedTripWithCrew(TRIP);
    await seed(`roadtrips/${TRIP}/settings/general`, { users: ['Lukas', 'Leon'], roles: { Lukas: 'owner' } });
    await assertSucceeds(getDoc(doc(memberDb(), `roadtrips/${TRIP}/settings/general`)));
  });

  it('weist ein Datum in falschem Format ab', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(
      setDoc(doc(ownerDb(), `roadtrips/${TRIP}/settings/general`), { startDate: '1.7.2026' })
    );
  });

  it('erlaubt der Crew weiterhin die Schnell-Logs, aber nicht Readonly', async () => {
    await seedTripWithCrew(TRIP);
    const quicklogs = `roadtrips/${TRIP}/settings/quicklogs`;
    await seed(quicklogs, { items: [{ id: 'pause', label: 'Pause', iconName: 'coffee' }] });

    await assertSucceeds(
      updateDoc(doc(memberDb(), quicklogs), {
        items: [{ id: 'pause', label: 'Kaffeepause', iconName: 'coffee' }]
      })
    );
    await assertFails(
      updateDoc(doc(readonlyDb(), quicklogs), {
        items: [{ id: 'pause', label: 'Kaffeepause', iconName: 'coffee' }]
      })
    );
  });

  it('erlaubt das Löschen der Einstellungen nur dem Owner (Roadtrip-Löschung)', async () => {
    await seedTripWithCrew(TRIP);
    await seed(`roadtrips/${TRIP}/settings/general`, { startDate: '2026-07-01' });
    await assertFails(deleteDoc(doc(memberDb(), `roadtrips/${TRIP}/settings/general`)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), `roadtrips/${TRIP}/settings/general`)));
  });
});

describe('Fehlerprotokoll', () => {
  const path = `roadtrips/${TRIP}/errors/f1`;

  it('nimmt einen Eintrag von jeder Rolle an, auch Readonly', async () => {
    await seedTripWithCrew(TRIP);
    await assertSucceeds(setDoc(doc(memberDb(), path), validError));
    await assertSucceeds(
      setDoc(doc(readonlyDb(), `roadtrips/${TRIP}/errors/f2`), {
        ...validError,
        stack: 'at Foo (bundle.js:1:1)',
        context: 'render',
        author: 'Lukas',
        authorId: READONLY_UID,
        appVersion: '0.1.0',
        userAgent: 'Mozilla/5.0',
        url: 'https://example.invalid/map'
      })
    );
  });

  it('verweigert eine authorId, die nicht der eigenen UID entspricht', async () => {
    await seedTripWithCrew(TRIP);
    await assertFails(setDoc(doc(memberDb(), path), { ...validError, authorId: OWNER_UID }));
  });

  it('verlangt eine Meldung', async () => {
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { timestamp: NOW }));
    await assertFails(setDoc(doc(db, path), { ...validError, message: '' }));
  });

  it('deckelt die Größe eines Eintrags', async () => {
    // Ohne Deckel wäre ausgerechnet der Fehlerkanal der bequemste Weg, die
    // Datenbank vollzuschreiben – er nimmt beliebigen Text entgegen.
    await seedTripWithCrew(TRIP);
    const db = memberDb();
    await assertFails(setDoc(doc(db, path), { ...validError, message: 'x'.repeat(1001) }));
    await assertFails(setDoc(doc(db, path), { ...validError, stack: 'x'.repeat(4001) }));
  });

  it('lässt Einträge nicht nachträglich ändern', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validError);
    await assertFails(setDoc(doc(memberDb(), path), { ...validError, message: 'harmlos' }));
  });

  it('erlaubt das Löschen nur dem Owner', async () => {
    await seedTripWithCrew(TRIP);
    await seed(path, validError);
    await assertFails(deleteDoc(doc(memberDb(), path)));
    await assertSucceeds(deleteDoc(doc(ownerDb(), path)));
  });

  it('bleibt für Nicht-Mitglieder unlesbar', async () => {
    await seedTripWithCrew(TRIP);
    await seed(`roadtrips/${OTHER_TRIP}`, { name: 'Fremd', ownerUid: OUTSIDER_UID, createdAt: NOW });
    await seed(`roadtrips/${OTHER_TRIP}/errors/f1`, validError);
    // memberDb() gehört zur Crew von TRIP, aber nicht zu OTHER_TRIP.
    await assertFails(getDoc(doc(memberDb(), `roadtrips/${OTHER_TRIP}/errors/f1`)));
  });
});

describe('Plattform-Administration', () => {
  /** Profil mit `role: "admin"` – wird ausschließlich direkt in Firebase gesetzt. */
  async function seedPlatformAdmin() {
    await seed(`users/${ADMIN_UID}`, {
      displayName: 'Admin',
      email: 'admin@example.com',
      createdAt: NOW,
      role: 'admin'
    });
  }

  it('lässt die Administration alle Roadtrips auflisten und lesen', async () => {
    await seedTripWithCrew(TRIP);
    await seedTripWithCrew(OTHER_TRIP);
    await seedPlatformAdmin();

    const snap = await assertSucceeds(getDocs(collection(adminDb(), 'roadtrips')));
    expect(snap.size).toBe(2);
    await assertSucceeds(getDoc(doc(adminDb(), `roadtrips/${TRIP}`)));
  });

  it('lässt die Administration die Mitglieder eines fremden Roadtrips lesen', async () => {
    await seedTripWithCrew(TRIP);
    await seedPlatformAdmin();

    const snap = await assertSucceeds(getDocs(collection(adminDb(), `roadtrips/${TRIP}/members`)));
    expect(snap.size).toBe(3);
    await assertSucceeds(getDoc(doc(adminDb(), `roadtrips/${TRIP}/members/${MEMBER_UID}`)));
  });

  it('gibt der Administration keinerlei Schreibrecht und keinen Blick in die Trip-Daten', async () => {
    await seedTripWithCrew(TRIP);
    await seed(`roadtrips/${TRIP}/events/e1`, validEvent);
    await seedPlatformAdmin();
    const db = adminDb();

    await assertFails(getDoc(doc(db, `roadtrips/${TRIP}/events/e1`)));
    await assertFails(setDoc(doc(db, `roadtrips/${TRIP}/events/e2`), validEvent));
    await assertFails(deleteDoc(doc(db, `roadtrips/${TRIP}`)));
    await assertFails(
      updateDoc(doc(db, `roadtrips/${TRIP}/members/${MEMBER_UID}`), { role: 'owner' })
    );
    await assertFails(
      setDoc(doc(db, `roadtrips/${TRIP}/members/${ADMIN_UID}`), {
        displayName: 'Admin',
        role: 'owner',
        joinedAt: serverTimestamp()
      })
    );
  });

  it('lässt eine gewöhnliche Person weder Roadtrips noch fremde Mitglieder auflisten', async () => {
    await seedTripWithCrew(TRIP);
    await seed(`users/${OUTSIDER_UID}`, {
      displayName: 'Outsider',
      email: 'outsider@example.com',
      createdAt: NOW
    });

    await assertFails(getDocs(collection(outsiderDb(), 'roadtrips')));
    await assertFails(getDocs(collection(outsiderDb(), `roadtrips/${TRIP}/members`)));
  });

  it('lässt niemanden sich selbst zum Administrator machen', async () => {
    const db = outsiderDb();
    // Beim Anlegen des eigenen Profils ist role kein erlaubtes Feld …
    await assertFails(
      setDoc(doc(db, `users/${OUTSIDER_UID}`), {
        displayName: 'Outsider',
        email: `${OUTSIDER_UID}@example.com`,
        createdAt: serverTimestamp(),
        role: 'admin'
      })
    );
    // … und nachträglich ändern lässt sich das Profil ohnehin nicht.
    await seed(`users/${OUTSIDER_UID}`, {
      displayName: 'Outsider',
      email: `${OUTSIDER_UID}@example.com`,
      createdAt: NOW
    });
    await assertFails(updateDoc(doc(db, `users/${OUTSIDER_UID}`), { role: 'admin' }));
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
