import { describe, it, expect } from 'vitest';
import {
  buildEventNotification,
  buildExpenseNotification,
  buildStalledNotification,
  findStalledSessions,
  formatAmount,
  selectRecipients,
  STALL_THRESHOLD_MS,
  DeviceRegistration,
  TrackingSession
} from './notifications';

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

describe('formatAmount', () => {
  it('schreibt Beträge deutsch mit Komma', () => {
    expect(formatAmount(42.5)).toBe('42,50 €');
    expect(formatAmount(0)).toBe('0,00 €');
    expect(formatAmount(1234.567)).toBe('1234,57 €');
  });
});

describe('buildExpenseNotification', () => {
  it('nennt Betrag, Erfasser und Beschreibung', () => {
    const notification = buildExpenseNotification({
      title: 'Diesel',
      amountEuro: 84.5,
      author: 'Lukas',
      paidBy: 'Lukas'
    });

    expect(notification.title).toBe('Neue Ausgabe: 84,50 €');
    expect(notification.body).toBe('Lukas hat „Diesel“ eingetragen.');
    expect(notification.path).toBe('/costs');
    expect(notification.topic).toBe('expenses');
  });

  it('nennt den Zahler nur, wenn er nicht der Erfasser ist', () => {
    const fremd = buildExpenseNotification({
      title: 'Liegeplatz',
      amountEuro: 30,
      author: 'Leon',
      paidBy: 'Bordkasse'
    });

    expect(fremd.body).toContain('bezahlt von Bordkasse');
  });
});

describe('buildEventNotification', () => {
  it('nennt Kategorie, Erfasser und Titel', () => {
    const notification = buildEventNotification({
      title: 'Schleuse Spandau',
      author: 'Niklas',
      categoryLabel: 'Schleuse'
    });

    expect(notification.title).toBe('Logbuch: Schleuse');
    expect(notification.body).toBe('Niklas hat „Schleuse Spandau“ protokolliert.');
    expect(notification.topic).toBe('events');
  });
});

describe('buildStalledNotification', () => {
  it('rundet die Stille auf ganze Minuten und führt zur Karte', () => {
    const notification = buildStalledNotification('Elias', 21 * MINUTE + 20_000);

    expect(notification.title).toBe('Keine Position von Elias');
    expect(notification.body).toContain('seit 21 Minuten');
    expect(notification.path).toBe('/map');
    expect(notification.topic).toBe('emergency');
  });
});

describe('findStalledSessions', () => {
  const session = (overrides: Partial<TrackingSession> = {}): TrackingSession => ({
    user: 'Lukas',
    active: true,
    lastPointAt: NOW - 30 * MINUTE,
    ...overrides
  });

  it('meldet eine laufende Aufzeichnung ohne Punkte seit der Schwelle', () => {
    expect(findStalledSessions([session()], NOW)).toHaveLength(1);
  });

  it('ignoriert beendete Aufzeichnungen', () => {
    expect(findStalledSessions([session({ active: false })], NOW)).toEqual([]);
  });

  it('wartet die Schwelle ab, bevor gewarnt wird', () => {
    const kurzStill = session({ lastPointAt: NOW - (STALL_THRESHOLD_MS - MINUTE) });

    expect(findStalledSessions([kurzStill], NOW)).toEqual([]);
  });

  it('warnt pro Stille nur einmal', () => {
    const bereitsGewarnt = session({ alertedAt: NOW - 5 * MINUTE });

    expect(findStalledSessions([bereitsGewarnt], NOW)).toEqual([]);
  });

  it('warnt erneut, wenn nach der Warnung ein Punkt kam und die Stille von vorn beginnt', () => {
    // Reihenfolge: Warnung → neuer Punkt → wieder still.
    const wiederStill = session({
      alertedAt: NOW - 60 * MINUTE,
      lastPointAt: NOW - 40 * MINUTE
    });

    expect(findStalledSessions([wiederStill], NOW)).toHaveLength(1);
  });

  it('nimmt eine eigene Schwelle entgegen', () => {
    const session5min = session({ lastPointAt: NOW - 5 * MINUTE });

    expect(findStalledSessions([session5min], NOW, 2 * MINUTE)).toHaveLength(1);
    expect(findStalledSessions([session5min], NOW, 10 * MINUTE)).toEqual([]);
  });
});

describe('selectRecipients', () => {
  const device = (
    user: string,
    topics: Partial<DeviceRegistration['topics']>
  ): DeviceRegistration => ({
    token: `token-${user}`,
    user,
    topics: { expenses: false, events: false, emergency: false, ...topics }
  });

  it('liefert nur Geräte, die das Thema abonniert haben', () => {
    const devices = [device('Lukas', { expenses: true }), device('Leon', { events: true })];

    expect(selectRecipients(devices, 'expenses').map((d) => d.user)).toEqual(['Lukas']);
  });

  it('lässt die Geräte der auslösenden Person aus', () => {
    const devices = [device('Lukas', { expenses: true }), device('Leon', { expenses: true })];

    expect(selectRecipients(devices, 'expenses', 'Lukas').map((d) => d.user)).toEqual(['Leon']);
  });

  it('kommt mit einem Gerät ohne Themen-Feld zurecht', () => {
    const kaputt = { token: 't', user: 'Alt' } as DeviceRegistration;

    expect(selectRecipients([kaputt], 'expenses')).toEqual([]);
  });
});
