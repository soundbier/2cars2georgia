import * as Sentry from '@sentry/react';

/**
 * Fehler- und Crash-Monitoring für die Produktion. Ohne das lief die App
 * bisher komplett unbeobachtet – Abstürze auf dem Gerät eines
 * Crewmitglieds unterwegs blieben unsichtbar, niemand hätte je davon
 * erfahren.
 *
 * Bewusst optional: Ohne VITE_SENTRY_DSN (z.B. lokale Entwicklung, oder
 * schlicht kein Sentry-Projekt vorhanden) bleibt Sentry komplett inaktiv –
 * kein Netzwerkverkehr, keine Fehlermeldung, kein Verhaltensunterschied.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    release: __APP_VERSION__,
    // Session Replay/Tracing wären zusätzliche Kosten und zusätzlicher
    // Netzwerkverkehr auf einem Boot mit oft schwacher Verbindung – für den
    // Zweck hier (unsichtbare Bugs sichtbar machen) reicht reines
    // Error-Tracking ohne Performance-/Replay-Integrationen.
    tracesSampleRate: 0
  });
}

/**
 * Ordnet Fehlerberichte einem Konto und einem Roadtrip zu – ohne Klarnamen.
 *
 * Bisher stand der Anzeigename als Tag `crewUser` an jedem Bericht. Der ist
 * bei dieser Crew ein Klarname, und Sentry ist ein Dienst außerhalb der App:
 * Damit ging ein Personenbezug an einen Dritten, für einen Zweck, den auch
 * eine Kennung erfüllt. Stattdessen die Firebase-UID – sie ist pseudonym,
 * hält aber die Berichte einer Person zusammen, und wer dahintersteckt,
 * steht in der Crew-Liste des Roadtrips, nicht im Fehlerbericht.
 *
 * Die UID gehört dabei in `setUser`, der Roadtrip als Tag daneben: So zählt
 * Sentry "wie viele Personen betrifft dieser Fehler" richtig, und filtern
 * lässt sich weiterhin nach Roadtrip. Vorher stand der Roadtrip im
 * `setUser`-Feld, was beides vermischte.
 *
 * Der Anzeigename bleibt im Fehlerprotokoll des Roadtrips selbst
 * (`roadtrips/{tripId}/errors`, siehe lib/errorLog.ts): Das liegt in der
 * eigenen Datenbank und ist nur für die Crew lesbar – unterwegs ist genau
 * die Frage "auf wessen Gerät?" die erste, die zählt.
 */
export function setSentryContext(tripId: string | null, uid: string | null): void {
  Sentry.setUser(uid ? { id: uid } : null);
  Sentry.setTag('roadtrip', tripId ?? undefined);
}
