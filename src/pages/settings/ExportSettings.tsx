import { useMemo, useState } from 'react';
import { FileSpreadsheet, Route, FileText, Share2 } from 'lucide-react';
import { useCollectionOnce } from '../../hooks/useCollection';
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
import { useT } from '../../i18n';
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
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);

  // Einmalig beim Öffnen gelesen statt laufend abonniert: Ein Export ist eine
  // Momentaufnahme, und die ganze Spur als Dauerabo mitlaufen zu lassen kostet
  // Speicher und Leseoperationen für einen Stand, den hier niemand sieht.
  // Wer den neuesten Stand exportieren will, öffnet die Seite erneut.
  const { items: allEvents, loading: eventsLoading } = useCollectionOnce<LogEvent>(
    tripId ? tripPath(tripId, 'events') : null,
    'timestamp',
    'asc'
  );
  const { items: allExpenses, loading: expensesLoading } = useCollectionOnce<Expense>(
    tripId ? tripPath(tripId, 'expenses') : null,
    'timestamp',
    'asc'
  );
  const { items: track, loading: trackLoading } = useCollectionOnce<GpsPoint>(
    tripId ? tripPath(tripId, 'track') : null
  );
  // Solange noch geladen wird, ist „0 Einträge" keine Aussage über die Reise –
  // ein Export in diesem Moment wäre leer, obwohl Daten da sind.
  const loading = eventsLoading || expensesLoading || trackLoading;

  // Was im Papierkorb liegt, gehört nicht in einen Export, der als Erinnerung
  // oder Abrechnung weitergegeben wird.
  const events = useMemo(() => activeOnly(allEvents), [allEvents]);
  const expenses = useMemo(() => activeOnly(allExpenses), [allExpenses]);

  const name = tripName ?? t('export.defaultTripName');

  const distanceLabel = `${toDisplayDistance(totalDistanceKm(track), preferences.unitSystem).toFixed(1)} ${distanceUnitLabel(preferences.unitSystem)}`;
  const durationLabel = formatDuration(trackDurationMs(track));

  /** Kapselt Ladezustand und Fehlerbehandlung eines Exports. */
  const run = async (key: string, action: () => Promise<void> | void) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      console.error(err);
      notify(t('export.failed'), 'danger');
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
      if (result === 'downloaded') notify(t('export.saved'), 'success');
      if (result === 'shared') notify(t('export.shared'), 'success');
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
        title={t('export.title')}
        subtitle={t('export.subtitle')}
        backTo="/settings"
        backLabel={t('settings.title')}
      />

      <Section title={t('export.reportSection')}>
        <p className="helper-text setting-note">{t('export.reportHint')}</p>
        <Button fullWidth disabled={busy !== null || loading} onClick={exportReport}>
          <FileText size={18} /> {t('export.reportButton')}
        </Button>
      </Section>

      <Section title={t('export.rawDataSection')}>
        <p className="helper-text setting-note">{t('export.rawDataHint')}</p>
        <div className="stack">
          <Button
            variant="secondary"
            fullWidth
            disabled={busy !== null || loading || events.length === 0}
            onClick={() =>
              exportFile('events', 'logbuch', 'csv', 'text/csv', () =>
                withBom(eventsToCsv(events, quickLogs))
              )
            }
          >
            <FileSpreadsheet size={18} /> {t('export.eventsButton', { count: events.length })}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={busy !== null || loading || expenses.length === 0}
            onClick={() =>
              exportFile('expenses', 'reisekasse', 'csv', 'text/csv', () =>
                withBom(expensesToCsv(expenses))
              )
            }
          >
            <FileSpreadsheet size={18} /> {t('export.expensesButton', { count: expenses.length })}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={busy !== null || loading || track.length === 0}
            onClick={() =>
              exportFile('track', 'route', 'gpx', 'application/gpx+xml', () =>
                trackToGpx(track, events, name)
              )
            }
          >
            <Route size={18} /> {t('export.trackButton', { count: track.length })}
          </Button>
        </div>
      </Section>

      <Section title={t('export.noteSection')}>
        <p className="helper-text setting-note">
          <Share2 size={13} className="setting-note-icon" />
          {t('export.noteText')}
        </p>
      </Section>
    </div>
  );
}
