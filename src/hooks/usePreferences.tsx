import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { UnitSystem } from '../lib/units';

const STORAGE_KEY = 'boat_preferences';

export interface Preferences {
  /** Metrisch (km/h, km) oder nautisch (kn, sm). */
  unitSystem: UnitSystem;
  /** OpenSeaMap-Seezeichen über der Grundkarte einblenden. */
  showSeamarks: boolean;
  /** Mindestabstand zwischen zwei gespeicherten Trackpunkten. */
  trackIntervalMs: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  unitSystem: 'metric',
  showSeamarks: true,
  trackIntervalMs: 30_000
};

function readStored(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    // Unbekannte/fehlende Felder fallen auf die Defaults zurück, damit ein
    // älterer gespeicherter Stand die App nicht in einen kaputten Zustand bringt.
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch (err) {
    console.error('Einstellungen konnten nicht gelesen werden:', err);
    return DEFAULT_PREFERENCES;
  }
}

interface PreferencesContextValue {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Geräteeinstellungen (Anzeige, Karte, Aufzeichnung).
 *
 * Bewusst in localStorage statt Firestore: Es sind persönliche Anzeige- und
 * Akku-Entscheidungen des jeweiligen Geräts, keine Daten der gesamten Crew.
 * Sie stehen dadurch auch offline sofort zur Verfügung.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (err) {
      console.error('Einstellungen konnten nicht gespeichert werden:', err);
    }
  }, [preferences]);

  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
      setPreferences((prev) => ({ ...prev, [key]: value })),
    []
  );

  const value = useMemo(() => ({ preferences, setPreference }), [preferences, setPreference]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences muss innerhalb von PreferencesProvider verwendet werden');
  return ctx;
}
