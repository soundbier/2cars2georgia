import { createContext, useCallback, useContext, useEffect, useMemo, ReactNode } from 'react';
import { usePreferences } from '../hooks/usePreferences';
import {
  translate,
  Language,
  LANGUAGES,
  LOCALES,
  TranslationKey,
  TranslationParams
} from './translate';

export type { Language, TranslationKey };
export { LANGUAGES, LOCALES };

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /** BCP-47-Kennung der aktiven Sprache, z.B. für Intl-Formatierer. */
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Stellt die Oberflächensprache bereit.
 *
 * Die Wahl liegt in den Geräteeinstellungen (localStorage, siehe
 * usePreferences) und nicht in Firestore: Auf welcher Sprache jemand die App
 * liest, ist eine persönliche Entscheidung des Geräts – in einer gemischten
 * Crew soll niemand die Sprache für alle anderen umstellen.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferences, setPreference } = usePreferences();
  const language = preferences.language;

  // Ohne das bliebe im Markup `lang="de"` stehen: Screenreader sprächen
  // englische Texte mit deutscher Aussprache, und die Silbentrennung des
  // Browsers läge daneben.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
    [language]
  );

  const setLanguage = useCallback(
    (next: Language) => setPreference('language', next),
    [setPreference]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, locale: LOCALES[language] }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n muss innerhalb von I18nProvider verwendet werden');
  return ctx;
}

/** Kurzform für Komponenten, die nur Texte brauchen. */
export function useT() {
  return useI18n().t;
}
