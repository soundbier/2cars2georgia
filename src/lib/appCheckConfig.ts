/**
 * App Check ist Pflicht für einen Produktions-Build.
 *
 * App Check (reCAPTCHA v3) bestätigt Firebase serverseitig, dass eine Anfrage
 * von der echten App kommt und nicht von einem Skript. Ohne ihn bremst nur
 * die Drosselung von Firebase Auth – und die wirkt ausschließlich auf
 * Anmeldeversuche, nicht auf Firestore-Leseanfragen. Der clientseitige
 * Throttle (lib/attemptThrottle.ts) ist gegen ein Skript ohnehin wirkungslos:
 * Er läuft im Browser, den ein Angreifer gar nicht erst benutzt.
 *
 * Bisher war der Site-Key optional: Fehlte er, blieb App Check still
 * inaktiv – und ob er im ausgelieferten Build gesetzt war, ließ sich
 * nirgends ablesen. Ein vergessener Schlüssel darf nicht wie ein normaler
 * Build aussehen, deshalb bricht der Build jetzt ab (siehe vite.config.ts).
 *
 * Für die lokale Entwicklung bleibt er optional: Dort gibt es keine
 * öffentliche Angriffsfläche, und der Emulator kennt App Check gar nicht.
 */

/** Name der Umgebungsvariable mit dem reCAPTCHA-v3-Site-Key. */
export const APP_CHECK_ENV_KEY = 'VITE_RECAPTCHA_SITE_KEY';

/**
 * Meldung, wenn einem Produktions-Build der App-Check-Schlüssel fehlt –
 * sonst null.
 *
 * Bewusst als reine Funktion über einem Umgebungs-Objekt: So prüft sie sich
 * im Test ohne echten Build, und vite.config.ts reicht einfach das Ergebnis
 * von loadEnv() herein.
 */
export function appCheckBuildError(env: Record<string, string | undefined>): string | null {
  if ((env[APP_CHECK_ENV_KEY] ?? '').trim()) return null;
  return (
    `${APP_CHECK_ENV_KEY} fehlt. Ein Produktions-Build ohne App Check ist ` +
    'nicht zulässig: Firebase kann dann nicht unterscheiden, ob eine Anfrage ' +
    'von der App oder von einem Skript kommt. Site-Key in der Firebase ' +
    'Console unter App Check → Apps → reCAPTCHA v3 anlegen und in der ' +
    'Build-Umgebung setzen (siehe README, Abschnitt "App Check"). Nur für ' +
    'einen Testbau ohne Firebase: APP_CHECK_OPTIONAL=1 setzen.'
  );
}

/**
 * Notausgang für Builds, die nachweislich nie ausgeliefert werden – etwa der
 * Build-Durchlauf im CI, der nur prüft, ob überhaupt gebaut werden kann.
 */
export function appCheckOptional(env: Record<string, string | undefined>): boolean {
  return env.APP_CHECK_OPTIONAL === '1';
}
