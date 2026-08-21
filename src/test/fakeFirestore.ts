/**
 * Winziges Firestore für Tests.
 *
 * Ersetzt in Komponententests das Modul `firebase/firestore` durch einen
 * Speicher im Arbeitsspeicher: Dokumente liegen unter ihrem Pfad, onSnapshot
 * liefert sofort und bei jeder Änderung erneut. Damit lassen sich Seiten, die
 * ihre Daten aus dem Roadtrip lesen, ohne Emulator und ohne Netz prüfen – die
 * Regeln dahinter deckt tests/rules/firestore.rules.test.ts ab.
 *
 * Verwendung:
 *   vi.mock('../firebase', () => ({ db: {} }));
 *   vi.mock('firebase/firestore', () => fakeFirestoreModule());
 */

type DocData = Record<string, unknown>;

interface Ref {
  __path: string;
  __kind: 'doc' | 'collection';
}

const documents = new Map<string, DocData>();
const listeners = new Set<{ ref: Ref; emit: () => void }>();

function notify(): void {
  for (const listener of [...listeners]) listener.emit();
}

function collectionDocs(path: string): Array<{ id: string; data: DocData }> {
  const prefix = `${path}/`;
  return [...documents.entries()]
    .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
    .map(([key, data]) => ({ id: key.slice(prefix.length), data }));
}

/** Alle Dokumente vergessen – gehört in ein beforeEach. */
export function resetFakeFirestore(): void {
  documents.clear();
  listeners.clear();
}

/** Dokument direkt setzen, ohne den Umweg über die Oberfläche. */
export function seedFakeDoc(path: string, data: DocData): void {
  documents.set(path, data);
  notify();
}

/** Aktueller Stand eines Dokuments, für Erwartungen im Test. */
export function readFakeDoc(path: string): DocData | undefined {
  return documents.get(path);
}

/** Alle Dokumente einer Collection, für Erwartungen im Test. */
export function readFakeCollection(path: string): Array<{ id: string; data: DocData }> {
  return collectionDocs(path);
}

/** Die Nachbildung der von der App benutzten firebase/firestore-Funktionen. */
export function fakeFirestoreModule() {
  return {
    collection: (_db: unknown, ...segments: string[]): Ref => ({
      __path: segments.join('/'),
      __kind: 'collection'
    }),
    doc: (_db: unknown, ...segments: string[]): Ref => ({
      __path: segments.join('/'),
      __kind: 'doc'
    }),
    // Sortierung und Filter interessieren hier nicht: Die App sortiert die
    // Routen ohnehin selbst (siehe lib/plannedRoute.ts).
    query: (ref: Ref) => ref,
    orderBy: () => ({}),
    where: () => ({}),
    onSnapshot: (ref: Ref, next: (snapshot: unknown) => void) => {
      const emit = () => {
        if (ref.__kind === 'collection') {
          next({
            docs: collectionDocs(ref.__path).map(({ id, data }) => ({ id, data: () => data }))
          });
        } else {
          const data = documents.get(ref.__path);
          next({ exists: () => data !== undefined, data: () => data });
        }
      };
      const entry = { ref, emit };
      listeners.add(entry);
      emit();
      return () => {
        listeners.delete(entry);
      };
    },
    setDoc: async (ref: Ref, data: DocData) => {
      documents.set(ref.__path, data);
      notify();
    },
    updateDoc: async (ref: Ref, patch: DocData) => {
      documents.set(ref.__path, { ...(documents.get(ref.__path) ?? {}), ...patch });
      notify();
    },
    deleteDoc: async (ref: Ref) => {
      documents.delete(ref.__path);
      notify();
    },
    getDoc: async (ref: Ref) => {
      const data = documents.get(ref.__path);
      return { exists: () => data !== undefined, data: () => data };
    },
    getDocs: async (ref: Ref) => ({
      docs: collectionDocs(ref.__path).map(({ id, data }) => ({ id, data: () => data }))
    }),
    writeBatch: () => {
      const staged: Array<[Ref, DocData]> = [];
      return {
        set: (ref: Ref, data: DocData) => {
          staged.push([ref, data]);
        },
        commit: async () => {
          for (const [ref, data] of staged) documents.set(ref.__path, data);
          notify();
        }
      };
    },
    serverTimestamp: () => Date.now()
  };
}
