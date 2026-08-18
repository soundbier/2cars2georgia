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

/** Ordnet Fehlerberichte dem angemeldeten Roadtrip/Crewmitglied zu, ohne echte PII zu senden. */
export function setSentryContext(tripId: string | null, user: string | null): void {
  Sentry.setUser(tripId ? { id: tripId } : null);
  Sentry.setTag('crewUser', user ?? undefined);
}
