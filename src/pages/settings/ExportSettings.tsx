import { useMemo, useState } from 'react';
import { FileSpreadsheet, Route, FileText, Share2 } from 'lucide-react';
import { useCollection } from '../../hooks/useCollection';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { useQuickLogs } from '../../hooks/useSettings';
import { usePreferences } from '../../hooks/usePreferences';
import { activeOnly } from '../../lib/trash';
import { computeSettlement } from '../../lib/settlement';
import { distanceUnitLabel, toDisplayDistance } from '../../lib/units';
import { formatDuration, totalDistanceKm, trackDurationMs } from '../../lib/tripStats';
import {
  buildReportHtml,
  eventsToCsv,
  expensesToCsv,
  exportFileName,
  trackToGpx,
  withBom
} from '../../lib/exportFormats';
import { printHtmlDocument, shareOrDownload } from '../../lib/fileExport';
import { Expense, GpsPoint, LogEvent } from '../../types';
import { Button, Section, PageHeader, useToast } from '../../components/ui';
import '../Settings.css';

interface Props {
  users: string[];
}

export default function ExportSettings({ users }: Props) {
  const { tripId, tripName } = useRoadtrip();
  const quickLogs = useQuickLogs();
  const { preferences } = usePreferences();
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const allEvents = useCollection<LogEvent>(tripId ? tripPath(tripId, 'events') : null, 'timestamp', 'asc');
  const allExpenses = useCollection<Expense>(tripId ? tripPath(tripId, 'expenses') : null, 'timestamp', 'asc');
  const track = useCollection<GpsPoint>(tripId ? tripPath(tripId, 'track') : null);

  // Was im Papierkorb liegt, gehört nicht in einen Export, der als Erinnerung
  // oder Abrechnung weitergegeben wird.
  const events = useMemo(() => activeOnly(allEvents), [allEvents]);
  const expenses = useMemo(() => activeOnly(allExpenses), [allExpenses]);

  const name = tripName ?? 'Roadtrip';

  const distanceLabel = `${toDisplayDistance(totalDistanceKm(track), preferences.unitSystem).toFixed(1)} ${distanceUnitLabel(preferences.unitSystem)}`;
  const durationLabel = formatDuration(trackDurationMs(track));

  /** Kapselt Ladezustand und Fehlerbehandlung eines Exports. */
  const run = async (key: string, action: () => Promise<void> | void) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      console.error(err);
      notify('Export fehlgeschlagen.', 'danger');
    } finally {
      setBusy(null);
    }
  };

  const exportFile = (key: string, suffix: string, extension: string, mimeType: string, build: () => string) =>
    run(key, async () => {
      const result = await shareOrDownload(
        exportFileName(name, suffix, extension),
        mimeType,
        build()
      );
      if (result === 'downloaded') notify('Datei gespeichert', 'success');
      if (result === 'shared') notify('Datei geteilt', 'success');
    });

  const exportReport = () =>
    run('report', () => {
      printHtmlDocument(
        buildReportHtml({
          tripName: name,
          distanceLabel,
          durationLabel,
          events,
          expenses,
          quickLogs,
          settlement: computeSettlement(expenses, users)
        })
      );
    });

  return (
    <div className="settings-page">
      <PageHeader
        title="Export"
        subtitle="Route, Logbuch und Kosten sichern oder teilen"
        backTo="/settings"
        backLabel="Einstellungen"
      />

      <Section title="Reisebericht">
        <p className="helper-text setting-note">
          Öffnet den Druckdialog mit Logbuch, Reisekasse und Ausgleich. Dort „Als PDF sichern“
          wählen, um den Bericht zu behalten oder zu verschicken.
        </p>
        <Button fullWidth disabled={busy !== null} onClick={exportReport}>
          <FileText size={18} /> Bericht als PDF
        </Button>
      </Section>

      <Section title="Rohdaten">
        <p className="helper-text setting-note">
          CSV öffnet sich in jeder Tabellenkalkulation, GPX in Karten-Apps wie OsmAnd, Komoot oder
          Google Earth.
        </p>
        <div className="stack">
          <Button
            variant="secondary"
            fullWidth
            disabled={busy !== null || events.length === 0}
            onClick={() =>
              exportFile('events', 'logbuch', 'csv', 'text/csv', () =>
                withBom(eventsToCsv(events, quickLogs))
              )
            }
          >
            <FileSpreadsheet size={18} /> Logbuch als CSV ({events.length})
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={busy !== null || expenses.length === 0}
            onClick={() =>
              exportFile('expenses', 'reisekasse', 'csv', 'text/csv', () =>
                withBom(expensesToCsv(expenses))
              )
            }
          >
            <FileSpreadsheet size={18} /> Reisekasse als CSV ({expenses.length})
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={busy !== null || track.length === 0}
            onClick={() =>
              exportFile('track', 'route', 'gpx', 'application/gpx+xml', () =>
                trackToGpx(track, events, name)
              )
            }
          >
            <Route size={18} /> Route als GPX ({track.length} Punkte)
          </Button>
        </div>
      </Section>

      <Section title="Hinweis">
        <p className="helper-text setting-note">
          <Share2 size={13} className="setting-note-icon" />
          Auf dem Handy öffnet sich das Teilen-Menü des Systems, am Rechner wird die Datei
          heruntergeladen. Exportierte Dateien enthalten Namen, Positionen und Beträge der Crew –
          nur weitergeben, wenn alle einverstanden sind.
        </p>
      </Section>
    </div>
  );
}
