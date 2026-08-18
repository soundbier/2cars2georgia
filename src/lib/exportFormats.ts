import { Expense, GpsPoint, LogEvent, QuickLogConfig } from '../types';
import { Settlement, formatEuro } from './settlement';

/**
 * Serialisierung der Reisedaten in teilbare Dateiformate. Bewusst reine
 * Funktionen ohne DOM- oder Firestore-Bezug, damit sie testbar bleiben – das
 * Herunterladen bzw. Teilen liegt in lib/fileExport.ts.
 */

/**
 * Semikolon statt Komma: Tabellenkalkulationen im deutschsprachigen Raum
 * erwarten es als Standardtrenner, sonst landet die ganze Zeile in einer Spalte.
 */
const CSV_SEPARATOR = ';';

/** Byte Order Mark – ohne das zeigt Excel Umlaute als Mojibake an. */
export const CSV_BOM = '﻿';

export type CsvValue = string | number | undefined;

function escapeCsvValue(value: CsvValue): string {
  const text = value === undefined ? '' : String(value);
  if (!/["\n\r;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  // CRLF als Zeilenende: von RFC 4180 vorgeschrieben und von älteren
  // Tabellenprogrammen unter Windows als einziges zuverlässig erkannt.
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(CSV_SEPARATOR)).join('\r\n');
}

export function withBom(csv: string): string {
  return CSV_BOM + csv;
}

/** ISO-8601 in UTC – eindeutig und von jedem Tabellen- und GPS-Programm lesbar. */
function isoTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function localTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('de-DE');
}

export function eventsToCsv(events: LogEvent[], quickLogs: QuickLogConfig[]): string {
  const labelByType = new Map(quickLogs.map((q) => [q.id, q.label]));
  return toCsv(
    ['Zeit (ISO)', 'Zeit (lokal)', 'Kategorie', 'Titel', 'Crewmitglied', 'Notiz', 'Breite', 'Länge'],
    events.map((event) => [
      isoTime(event.timestamp),
      localTime(event.timestamp),
      labelByType.get(event.type) ?? event.type,
      event.title,
      event.author,
      event.note ?? '',
      event.lat,
      event.lng
    ])
  );
}

export function expensesToCsv(expenses: Expense[]): string {
  return toCsv(
    ['Zeit (ISO)', 'Zeit (lokal)', 'Beschreibung', 'Kategorie', 'Bezahlt von', 'Erfasst von', 'Betrag (EUR)'],
    expenses.map((expense) => [
      isoTime(expense.timestamp),
      localTime(expense.timestamp),
      expense.title,
      expense.category,
      expense.paidBy,
      expense.author,
      expense.amountEuro.toFixed(2)
    ])
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GPX 1.1: Die Trackpunkte werden zu einem Track mit einem Segment, die
 * Logbuch-Ereignisse zu Wegpunkten. Damit lässt sich die Reise in OsmAnd,
 * Garmin BaseCamp, Komoot oder Google Earth öffnen.
 */
export function trackToGpx(track: GpsPoint[], events: LogEvent[], tripName: string): string {
  const waypoints = events.map(
    (event) =>
      `  <wpt lat="${event.lat}" lon="${event.lng}">\n` +
      `    <time>${isoTime(event.timestamp)}</time>\n` +
      `    <name>${escapeXml(event.title)}</name>\n` +
      `    <type>${escapeXml(event.type)}</type>\n` +
      `  </wpt>`
  );

  const points = track.map(
    (point) =>
      `      <trkpt lat="${point.lat}" lon="${point.lng}">\n` +
      `        <time>${isoTime(point.timestamp)}</time>\n` +
      `      </trkpt>`
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="2cars2georgia" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${escapeXml(tripName)}</name>`,
    '  </metadata>',
    ...waypoints,
    '  <trk>',
    `    <name>${escapeXml(tripName)}</name>`,
    '    <trkseg>',
    ...points,
    '    </trkseg>',
    '  </trk>',
    '</gpx>'
  ].join('\n');
}

export interface ReportData {
  tripName: string;
  distanceLabel: string;
  durationLabel: string;
  events: LogEvent[];
  expenses: Expense[];
  quickLogs: QuickLogConfig[];
  settlement: Settlement;
}

function escapeHtml(value: string): string {
  return escapeXml(value).replace(/'/g, '&#39;');
}

/**
 * Druckfertiger Bericht als eigenständiges HTML-Dokument. Der Browser erzeugt
 * daraus über den Druckdialog ein PDF – das spart eine PDF-Bibliothek im
 * Bundle, die auf einem Handy mit knapper Mobilverbindung teuer wäre.
 */
export function buildReportHtml(data: ReportData): string {
  const { tripName, distanceLabel, durationLabel, events, expenses, quickLogs, settlement } = data;
  const labelByType = new Map(quickLogs.map((q) => [q.id, q.label]));
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amountEuro, 0);

  const eventRows = events
    .map(
      (event) =>
        `<tr><td>${escapeHtml(localTime(event.timestamp))}</td>` +
        `<td>${escapeHtml(labelByType.get(event.type) ?? event.type)}</td>` +
        `<td>${escapeHtml(event.title)}</td>` +
        `<td>${escapeHtml(event.author)}</td></tr>`
    )
    .join('\n');

  const expenseRows = expenses
    .map(
      (expense) =>
        `<tr><td>${escapeHtml(localTime(expense.timestamp))}</td>` +
        `<td>${escapeHtml(expense.title)}</td>` +
        `<td>${escapeHtml(expense.paidBy)}</td>` +
        `<td class="num">${expense.amountEuro.toFixed(2)} €</td></tr>`
    )
    .join('\n');

  const balanceRows = settlement.balances
    .map(
      (balance) =>
        `<tr><td>${escapeHtml(balance.user)}</td>` +
        `<td class="num">${formatEuro(balance.paidCents)}</td>` +
        `<td class="num">${formatEuro(balance.shareCents)}</td>` +
        `<td class="num">${formatEuro(balance.balanceCents)}</td></tr>`
    )
    .join('\n');

  const transferItems = settlement.transfers
    .map(
      (transfer) =>
        `<li>${escapeHtml(transfer.from)} zahlt ${escapeHtml(transfer.to)} ` +
        `<strong>${formatEuro(transfer.amountCents)}</strong></li>`
    )
    .join('\n');

  const emptyRow = (columns: number, text: string) =>
    `<tr><td colspan="${columns}" class="empty">${text}</td></tr>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escapeHtml(tripName)} – Reisebericht</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #16202b; font-size: 11pt; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  h2 { font-size: 13pt; margin: 24px 0 8px; border-bottom: 1px solid #c9d4de; padding-bottom: 4px; }
  .meta { color: #5b6b7a; font-size: 9pt; margin-bottom: 16px; }
  .summary { display: flex; gap: 32px; margin-bottom: 8px; }
  .summary div span { display: block; }
  .summary .label { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #5b6b7a; }
  .summary .value { font-size: 15pt; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e3eaf0; vertical-align: top; }
  th { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #5b6b7a; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: #5b6b7a; font-style: italic; }
  ul { margin: 0; padding-left: 18px; }
  tr { break-inside: avoid; }
</style>
</head>
<body>
<h1>${escapeHtml(tripName)}</h1>
<p class="meta">Reisebericht, erstellt am ${escapeHtml(localTime(Date.now()))}</p>

<div class="summary">
  <div><span class="label">Strecke</span><span class="value">${escapeHtml(distanceLabel)}</span></div>
  <div><span class="label">Dauer</span><span class="value">${escapeHtml(durationLabel)}</span></div>
  <div><span class="label">Ausgaben</span><span class="value">${expenseTotal.toFixed(2)} €</span></div>
</div>

<h2>Logbuch (${events.length})</h2>
<table>
  <thead><tr><th>Zeit</th><th>Kategorie</th><th>Ereignis</th><th>Crew</th></tr></thead>
  <tbody>
${eventRows || emptyRow(4, 'Keine Ereignisse erfasst.')}
  </tbody>
</table>

<h2>Reisekasse (${expenses.length})</h2>
<table>
  <thead><tr><th>Zeit</th><th>Beschreibung</th><th>Bezahlt von</th><th class="num">Betrag</th></tr></thead>
  <tbody>
${expenseRows || emptyRow(4, 'Keine Ausgaben erfasst.')}
  </tbody>
</table>

<h2>Ausgleich</h2>
<table>
  <thead><tr><th>Crewmitglied</th><th class="num">Ausgelegt</th><th class="num">Anteil</th><th class="num">Saldo</th></tr></thead>
  <tbody>
${balanceRows || emptyRow(4, 'Keine Beteiligten.')}
  </tbody>
</table>
<p>Aus der Bordkasse bezahlt: <strong>${formatEuro(settlement.sharedTotalCents)}</strong> (nicht im Ausgleich enthalten,
da bereits gemeinsam finanziert).</p>
${transferItems ? `<ul>\n${transferItems}\n</ul>` : '<p>Alle Salden sind bereits ausgeglichen.</p>'}
</body>
</html>`;
}

/** Dateiname ohne Zeichen, die auf iOS/Android/Windows Probleme machen. */
export function exportFileName(tripName: string, suffix: string, extension: string): string {
  const slug =
    tripName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'roadtrip';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${suffix}-${date}.${extension}`;
}
