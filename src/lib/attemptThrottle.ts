// Bremst wiederholte Fehlversuche im RoadtripGate aus – rein clientseitig
// und pro Tab (Reload setzt zurück), also kein Ersatz für echten
// Brute-Force-Schutz. Der reicht bis zu Firebase Auths eigener,
// serverseitiger Drosselung (auth/too-many-requests) und optional Firebase
// App Check (siehe src/firebase.ts) – dieser Mechanismus hier macht nur
// das simple, ungezielte Durchprobieren im Browser selbst spürbar
// langsamer.
const FAILURE_THRESHOLD = 3;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;

let failureCount = 0;
let lockedUntil = 0;

/** Verbleibende Sperrzeit in Millisekunden, 0 wenn kein Lockout aktiv ist. */
export function msUntilUnlocked(): number {
  return Math.max(0, lockedUntil - Date.now());
}

/** Nach einem fehlgeschlagenen Versuch aufrufen – erhöht bei Bedarf die Sperrzeit. */
export function recordAttemptFailure(): void {
  failureCount += 1;
  if (failureCount >= FAILURE_THRESHOLD) {
    const delay = Math.min(BASE_DELAY_MS * 2 ** (failureCount - FAILURE_THRESHOLD), MAX_DELAY_MS);
    lockedUntil = Date.now() + delay;
  }
}

/** Nach einem erfolgreichen Versuch aufrufen – setzt den Zähler zurück. */
export function recordAttemptSuccess(): void {
  failureCount = 0;
  lockedUntil = 0;
}

/** Nur für Tests. */
export function __resetAttemptThrottleForTests(): void {
  failureCount = 0;
  lockedUntil = 0;
}
