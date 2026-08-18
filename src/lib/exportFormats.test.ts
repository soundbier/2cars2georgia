import { describe, it, expect } from 'vitest';
import {
  toCsv,
  withBom,
  CSV_BOM,
  eventsToCsv,
  expensesToCsv,
  trackToGpx,
  buildReportHtml,
  exportFileName
} from './exportFormats';
import { computeSettlement } from './settlement';
import { Expense, GpsPoint, LogEvent, QuickLogConfig } from '../types';

const T = 1_700_000_000_000;

const QUICK_LOGS: QuickLogConfig[] = [{ id: 'schleuse', label: 'Schleuse', iconName: 'anchor' }];

const EVENT: LogEvent = {
  timestamp: T,
  author: 'Lukas',
  type: 'schleuse',
  title: 'Schleuse Kostrzyn',
  lat: 52.5,
  lng: 14.6
};

const EXPENSE: Expense = {
  timestamp: T,
  author: 'Lukas',
  paidBy: 'Lukas',
  title: 'Diesel',
  amountEuro: 42.5,
  category: 'tanken'
};

describe('toCsv', () => {
  it('trennt Spalten mit Semikolon und Zeilen mit CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 2]])).toBe('a;b\r\n1;2');
  });

  it('maskiert Werte mit Trennzeichen, Anführungszeichen oder Zeilenumbruch', () => {
    const csv = toCsv(['x'], [['a;b'], ['sagt "hallo"'], ['zeile\nzwei']]);

    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"sagt ""hallo"""');
    expect(csv).toContain('"zeile\nzwei"');
  });

  it('schreibt fehlende Werte als leere Zelle', () => {
    expect(toCsv(['a', 'b'], [[undefined, 'x']])).toBe('a;b\r\n;x');
  });

  it('stellt der Datei ein BOM voran', () => {
    expect(withBom('a;b')).toBe(`${CSV_BOM}a;b`);
  });
});

describe('eventsToCsv', () => {
  it('übersetzt die Kategorie-Id in ihre Bezeichnung', () => {
    const csv = eventsToCsv([EVENT], QUICK_LOGS);

    expect(csv).toContain('Schleuse;Schleuse Kostrzyn;Lukas');
    expect(csv).toContain('2023-11-14T22:13:20.000Z');
  });

  it('fällt auf die rohe Id zurück, wenn die Kategorie gelöscht wurde', () => {
    const csv = eventsToCsv([{ ...EVENT, type: 'entfernt' }], QUICK_LOGS);

    expect(csv).toContain(';entfernt;');
  });
});

describe('expensesToCsv', () => {
  it('schreibt Beträge mit zwei Nachkommastellen', () => {
    expect(expensesToCsv([EXPENSE])).toContain('42.50');
  });
});

describe('trackToGpx', () => {
  const track: GpsPoint[] = [
    { timestamp: T, author: 'Lukas', lat: 52.5, lng: 14.6, speedKmh: 8, headingDeg: 90 }
  ];

  it('erzeugt ein GPX mit Trackpunkten und Ereignis-Wegpunkten', () => {
    const gpx = trackToGpx(track, [EVENT], 'Georgia');

    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('<trkpt lat="52.5" lon="14.6">');
    expect(gpx).toContain('<wpt lat="52.5" lon="14.6">');
    expect(gpx).toContain('<name>Schleuse Kostrzyn</name>');
  });

  it('maskiert XML-Sonderzeichen in Namen', () => {
    const gpx = trackToGpx([], [{ ...EVENT, title: 'Fish & <Chips>' }], 'Tour "2"');

    expect(gpx).toContain('Fish &amp; &lt;Chips&gt;');
    expect(gpx).toContain('Tour &quot;2&quot;');
    expect(gpx).not.toContain('<Chips>');
  });

  it('bleibt auch ohne Daten wohlgeformt', () => {
    const gpx = trackToGpx([], [], 'Leer');

    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx.trimEnd().endsWith('</gpx>')).toBe(true);
  });
});

describe('buildReportHtml', () => {
  const report = () =>
    buildReportHtml({
      tripName: 'Georgia',
      distanceLabel: '123.4 km',
      durationLabel: '5h 20m',
      events: [EVENT],
      expenses: [EXPENSE],
      quickLogs: QUICK_LOGS,
      settlement: computeSettlement([EXPENSE], ['Lukas', 'Leon'])
    });

  it('enthält Kopfdaten, Logbuch, Kasse und Ausgleich', () => {
    const html = report();

    expect(html).toContain('<title>Georgia – Reisebericht</title>');
    expect(html).toContain('123.4 km');
    expect(html).toContain('Schleuse Kostrzyn');
    expect(html).toContain('42.50 €');
    expect(html).toContain('Leon zahlt Lukas');
  });

  it('maskiert Nutzertext gegen HTML-Injektion', () => {
    const html = buildReportHtml({
      tripName: 'Georgia',
      distanceLabel: '0 km',
      durationLabel: '0h 0m',
      events: [{ ...EVENT, title: '<script>alert(1)</script>' }],
      expenses: [],
      quickLogs: QUICK_LOGS,
      settlement: computeSettlement([], ['Lukas'])
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('weist leere Abschnitte aus statt sie wegzulassen', () => {
    const html = buildReportHtml({
      tripName: 'Georgia',
      distanceLabel: '0 km',
      durationLabel: '0h 0m',
      events: [],
      expenses: [],
      quickLogs: [],
      settlement: computeSettlement([], ['Lukas'])
    });

    expect(html).toContain('Keine Ereignisse erfasst.');
    expect(html).toContain('Keine Ausgaben erfasst.');
    expect(html).toContain('Alle Salden sind bereits ausgeglichen.');
  });
});

describe('exportFileName', () => {
  it('bildet einen dateisystemsicheren Namen mit Datum', () => {
    expect(exportFileName('Törn nach Georgia!', 'logbuch', 'csv')).toMatch(
      /^t-rn-nach-georgia-logbuch-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });

  it('fällt auf einen Standardnamen zurück, wenn nichts übrig bleibt', () => {
    expect(exportFileName('***', 'route', 'gpx')).toMatch(/^roadtrip-route-/);
  });
});
