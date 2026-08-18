import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share2, X } from 'lucide-react';
import { DayRecap } from '../lib/dayRecap';
import { drawRouteImage, canvasToPngFile, BackgroundStyle } from '../lib/routeImage';
import { shareOrDownloadFile } from '../lib/fileExport';
import { exportFileName } from '../lib/exportFormats';
import { formatDuration } from '../lib/tripStats';
import { distanceUnitLabel, toDisplayDistance } from '../lib/units';
import { usePreferences } from '../hooks/usePreferences';
import { useI18n, useT } from '../i18n';
import { Button, Select, useToast } from './ui';
import './DayRecapDialog.css';

interface DayRecapDialogProps {
  open: boolean;
  onClose: () => void;
  tripName: string;
  days: DayRecap[];
  /** Ausgewählter Tag beim Öffnen, z. B. der jüngste mit Track. */
  initialDayKey: string | null;
}

/**
 * Vorschau + Export der Tagesübersicht als teilbares Bild.
 *
 * Gezeichnet wird direkt auf ein sichtbares Canvas statt auf ein
 * verstecktes: so lässt sich das Ergebnis vor dem Teilen prüfen, ohne einen
 * zweiten Rendercode-Pfad zu pflegen.
 */
export function DayRecapDialog({ open, onClose, tripName, days, initialDayKey }: DayRecapDialogProps) {
  const titleId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dayKey, setDayKey] = useState(initialDayKey ?? days[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const { preferences, setPreference } = usePreferences();
  const { locale } = useI18n();
  const { notify } = useToast();
  const t = useT();

  useEffect(() => {
    if (open) setDayKey(initialDayKey ?? days[0]?.key ?? '');
  }, [open, initialDayKey, days]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const day = useMemo(() => days.find((d) => d.key === dayKey) ?? null, [days, dayKey]);

  const distanceLabel = day
    ? `${toDisplayDistance(day.distanceKm, preferences.unitSystem).toFixed(1)} ${distanceUnitLabel(preferences.unitSystem)}`
    : '';
  const durationLabel = day ? formatDuration(day.durationMs) : '';
  const dateLabel = day ? day.date.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long' }) : '';

  useEffect(() => {
    if (!open || !day || !canvasRef.current) return;
    drawRouteImage(canvasRef.current, {
      tripName,
      dateLabel,
      distanceLabel,
      durationLabel,
      track: day.track,
      events: day.events,
      backgroundStyle: preferences.dayRecapBackground
    });
  }, [open, day, tripName, dateLabel, distanceLabel, durationLabel, preferences.dayRecapBackground]);

  if (!open) return null;

  const handleExport = async () => {
    if (!canvasRef.current || !day) return;
    setBusy(true);
    try {
      const file = await canvasToPngFile(
        canvasRef.current,
        exportFileName(tripName, `tag-${day.key}`, 'png')
      );
      const result = await shareOrDownloadFile(file);
      if (result === 'downloaded') notify(t('export.saved'), 'success');
      if (result === 'shared') notify(t('export.shared'), 'success');
    } catch (err) {
      console.error(err);
      notify(t('export.failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog day-recap-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="day-recap-header">
          <h2 id={titleId} className="dialog-title">
            {t('dayRecap.title')}
          </h2>
          <button type="button" className="day-recap-close" onClick={onClose} aria-label={t('common.cancel')}>
            <X size={20} />
          </button>
        </div>

        <div className="day-recap-controls">
          {days.length > 1 && (
            <Select value={dayKey} onChange={(e) => setDayKey(e.target.value)} className="day-recap-select">
              {days.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.date.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' })}
                </option>
              ))}
            </Select>
          )}
          <Select
            value={preferences.dayRecapBackground}
            onChange={(e) => setPreference('dayRecapBackground', e.target.value as BackgroundStyle)}
            className="day-recap-select"
            aria-label={t('dayRecap.background')}
          >
            <option value="reduced">{t('dayRecap.background.reduced')}</option>
            <option value="standard">{t('dayRecap.background.standard')}</option>
            <option value="satellite">{t('dayRecap.background.satellite')}</option>
          </Select>
        </div>

        <div className="day-recap-preview">
          <canvas ref={canvasRef} className="day-recap-canvas" />
        </div>

        {day && day.track.length <= 1 && (
          <p className="helper-text day-recap-hint">{t('dayRecap.noTrackHint')}</p>
        )}

        <div className="dialog-actions">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth onClick={handleExport} disabled={busy || !day}>
            {typeof navigator.canShare === 'function' ? <Share2 size={18} /> : <Download size={18} />}
            {t('dayRecap.exportButton')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
