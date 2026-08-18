import { describe, it, expect } from 'vitest';
import { translate, detectLanguage, LANGUAGES, TRANSLATIONS } from './translate';
import { de } from './de';
import { en } from './en';

describe('translate', () => {
  it('liefert den Text der gewählten Sprache', () => {
    expect(translate('de', 'nav.logbook')).toBe('Logbuch');
    expect(translate('en', 'nav.logbook')).toBe('Log');
  });

  it('setzt Platzhalter ein', () => {
    expect(translate('de', 'crew.removed', { name: 'Leon' })).toBe('Leon entfernt');
    expect(translate('en', 'crew.removed', { name: 'Leon' })).toBe('Leon removed');
  });

  it('lässt unbekannte Platzhalter stehen, statt sie zu leeren', () => {
    // Sichtbar kaputt schlägt still falsch – ein fehlender Wert soll auffallen.
    expect(translate('de', 'crew.removed')).toBe('{name} entfernt');
  });

  it('wählt die Pluralform anhand von count', () => {
    expect(translate('de', 'settings.crewCount', { count: 1 })).toBe('1 Mitglied');
    expect(translate('de', 'settings.crewCount', { count: 4 })).toBe('4 Mitglieder');
    expect(translate('en', 'settings.crewCount', { count: 1 })).toBe('1 member');
    expect(translate('en', 'settings.crewCount', { count: 0 })).toBe('0 members');
  });

  it('nutzt count auch ohne Pluralformen als normalen Platzhalter', () => {
    expect(translate('de', 'logbook.events', { count: 3 })).toBe('Ereignisse (3)');
  });

  it('fällt bei unbekanntem Schlüssel auf den Schlüssel selbst zurück', () => {
    expect(translate('de', 'gibt.es.nicht' as never)).toBe('gibt.es.nicht');
  });
});

describe('detectLanguage', () => {
  it('erkennt die erste unterstützte Sprache des Geräts', () => {
    expect(detectLanguage(['de-AT', 'en-US'])).toBe('de');
    expect(detectLanguage(['en-GB'])).toBe('en');
    expect(detectLanguage(['fr-FR', 'de'])).toBe('de');
  });

  it('fällt auf Englisch zurück, wenn nichts passt', () => {
    expect(detectLanguage(['fr-FR', 'es-ES'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('Vollständigkeit der Übersetzungen', () => {
  it('kennt in jeder Sprache genau dieselben Schlüssel', () => {
    const reference = Object.keys(de).sort();
    for (const language of LANGUAGES) {
      expect(Object.keys(TRANSLATIONS[language]).sort()).toEqual(reference);
    }
  });

  it('lässt keinen Text leer, außer dem bewusst leeren Übersetzungshinweis', () => {
    for (const language of LANGUAGES) {
      const empty = Object.entries(TRANSLATIONS[language])
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect(empty).toEqual(language === 'de' ? ['privacy.translationNote'] : []);
    }
  });

  it('verwendet in jeder Sprache dieselben Platzhalter je Schlüssel', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();

    for (const key of Object.keys(de) as (keyof typeof de)[]) {
      expect({ key, params: placeholders(en[key]) }).toEqual({
        key,
        params: placeholders(de[key])
      });
    }
  });

  it('hält Pluralformen paarweise', () => {
    for (const language of LANGUAGES) {
      const keys = Object.keys(TRANSLATIONS[language]);
      const ones = keys.filter((key) => key.endsWith('_one'));
      expect(ones.length).toBeGreaterThan(0);
      for (const one of ones) {
        expect(keys).toContain(one.replace(/_one$/, '_other'));
      }
    }
  });
});
