import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { UnitSystem } from '../lib/units';
import { BaseLayerId, OverlayId, BASE_LAYERS, OVERLAYS } from '../lib/mapLayers';

const STORAGE_KEY = 'boat_preferences';

export interface Preferences {
  /** Metrisch (km/h, km) oder nautisch (kn, sm). */
  unitSystem: UnitSystem;
  /** Grundkarte unter allen anderen Ebenen. */
  baseLayer: BaseLayerId;
  /** Zusatzebenen über der Grundkarte, je Ebene ein/aus. */
  overlays: Record<OverlayId, boolean>;
  /** Mindestabstand zwischen zwei gespeicherten Trackpunkten. */
  trackIntervalMs: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  unitSystem: 'metric',
  baseLayer: 'osm',
  overlays: { seamarks: true, cycling: false, hiking: false },
  trackIntervalMs: 30_000
};

/** Stand vor der Ebenenauswahl: ein einzelner Schalter für die Seezeichen. */
interface LegacyPreferences {
  showSeamarks?: boolean;
}

function readStored(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const stored = JSON.parse(raw) as Partial<Preferences> & LegacyPreferences;

    // Unbekannte/fehlende Felder fallen auf die Defaults zurück, damit ein
    // älterer gespeicherter Stand die App nicht in einen kaputten Zustand bringt.
    const merged: Preferences = { ...DEFAULT_PREFERENCES, ...stored };
    if (!(merged.baseLayer in BASE_LAYERS)) merged.baseLayer = DEFAULT_PREFERENCES.baseLayer;

    // Overlays einzeln zusammenführen: Neue Ebenen einer App-Version starten
    // auf ihrem Default, ohne die Auswahl des Nutzers zu überschreiben.
    merged.overlays = { ...DEFAULT_PREFERENCES.overlays };
    for (const id of Object.keys(OVERLAYS) as OverlayId[]) {
      if (typeof stored.overlays?.[id] === 'boolean') merged.overlays[id] = stored.overlays[id];
    }
    // Migration: Der alte Einzelschalter bestimmt weiterhin die Seezeichen.
    if (!stored.overlays && typeof stored.showSeamarks === 'boolean') {
      merged.overlays.seamarks = stored.showSeamarks;
    }
    return merged;
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
