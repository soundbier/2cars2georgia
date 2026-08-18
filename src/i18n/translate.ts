import { de, Translations } from './de';
import { en } from './en';

export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const TRANSLATIONS: Record<Language, Translations> = { de, en };

/** BCP-47-Kennung für Intl (Datum, Zahlen, Pluralregeln). */
export const LOCALES: Record<Language, string> = { de: 'de-DE', en: 'en-GB' };

/**
 * Zählabhängige Texte tragen die Endungen `_one`/`_other`. Aufgerufen wird
 * jeweils mit dem Basisschlüssel, deshalb gehört auch dieser zum Schlüsseltyp.
 */
type PluralBaseKey<K> = K extends `${infer Base}_one` ? Base : never;

export type TranslationKey = keyof Translations | PluralBaseKey<keyof Translations>;

export type TranslationParams = Record<string, string | number>;

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/**
 * Übersetzt einen Schlüssel in der gewählten Sprache.
 *
 * Enthält `params` ein `count`, wird zuerst die passende Pluralform gesucht
 * (`key_one` / `key_other`, ermittelt über Intl.PluralRules der Zielsprache).
 * Gibt es keine, wird der Schlüssel unverändert verwendet – ein Text mit
 * Zähler muss nicht zwingend Pluralformen haben.
 *
 * Fehlt ein Schlüssel ganz, fällt es auf Deutsch als Referenzsprache zurück;
 * fehlt er auch dort, wird der Schlüssel selbst ausgegeben. Beides ist im
 * Zweifel sichtbar kaputt statt still leer – und der Typecheck verhindert es
 * ohnehin für alle Schlüssel, die im Code stehen.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const table = TRANSLATIONS[language];
  const lookupKeys: string[] = [];

  if (params && typeof params.count === 'number') {
    const category = new Intl.PluralRules(LOCALES[language]).select(params.count);
    lookupKeys.push(`${key}_${category}`, `${key}_other`);
  }
  lookupKeys.push(key);

  for (const candidate of lookupKeys) {
    const value = table[candidate as keyof Translations];
    if (typeof value === 'string') return interpolate(value, params);
  }

  const fallback = de[key as keyof Translations];
  return typeof fallback === 'string' ? interpolate(fallback, params) : key;
}

/** Die Sprache, in der die App startet, wenn noch nichts gewählt wurde. */
export function detectLanguage(
  preferred: readonly string[] = navigator.languages ?? [navigator.language]
): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (LANGUAGES.includes(base as Language)) return base as Language;
  }
  // Englisch als Rückfall statt Deutsch: Wessen Gerät weder auf Deutsch noch
  // auf Englisch steht, kommt mit Englisch mit höherer Wahrscheinlichkeit
  // zurecht.
  return 'en';
}
