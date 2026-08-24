import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { PreferencesProvider, usePreferences, DEFAULT_PREFERENCES } from './usePreferences';

const STORAGE_KEY = 'boat_preferences';

const wrapper = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe('Karteneinstellungen', () => {
  it('zeigt Ereignisse in mittlerer Größe, solange nichts gewählt wurde', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    expect(result.current.preferences.showMapEvents).toBe(true);
    expect(result.current.preferences.mapEventSize).toBe('medium');
    expect(result.current.preferences.mapControlSize).toBe('medium');
  });

  it('behält die gespeicherte Wahl über einen Neustart hinweg', () => {
    const first = renderHook(() => usePreferences(), { wrapper });
    act(() => {
      first.result.current.setPreference('showMapEvents', false);
      first.result.current.setPreference('mapControlSize', 'large');
    });
    first.unmount();

    const second = renderHook(() => usePreferences(), { wrapper });

    expect(second.result.current.preferences.showMapEvents).toBe(false);
    expect(second.result.current.preferences.mapControlSize).toBe('large');
  });

  it('fällt bei unbekannten Werten auf die Vorgabe zurück', () => {
    // Ein älterer oder von Hand veränderter Stand darf die Karte nicht in
    // einen Zustand ohne gültige Größe bringen.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mapEventSize: 'riesig', mapControlSize: 42, showMapEvents: 'nein' })
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });

    expect(result.current.preferences.mapEventSize).toBe(DEFAULT_PREFERENCES.mapEventSize);
    expect(result.current.preferences.mapControlSize).toBe(DEFAULT_PREFERENCES.mapControlSize);
    expect(result.current.preferences.showMapEvents).toBe(DEFAULT_PREFERENCES.showMapEvents);
  });
});
