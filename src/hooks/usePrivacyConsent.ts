import { useCallback, useState } from 'react';

const STORAGE_KEY = 'privacy_ack_v1';

/**
 * Bestätigung des Datenschutzhinweises für dieses Gerät.
 *
 * Bewusst außerhalb der Firebase-Anmeldung: Der Hinweis muss schon vor dem
 * ersten Login sichtbar sein (siehe PrivacyOnboarding.tsx), also lokal auf
 * dem Gerät gespeichert statt an ein Nutzerkonto gebunden. Ein neues Gerät
 * oder gelöschter Browser-Speicher zeigt den Hinweis entsprechend erneut.
 */
export function usePrivacyConsent() {
  const [acknowledged, setAcknowledged] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const acknowledge = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (err) {
      console.error('Datenschutz-Bestätigung konnte nicht gespeichert werden:', err);
    }
    setAcknowledged(true);
  }, []);

  return { acknowledged, acknowledge };
}
