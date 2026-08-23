import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { Button, Input } from './ui';
// Gleiche Anmutung wie das Speichern-Fenster nach dem Stoppen: Feld über
// Feld, Aktionen unten. Deshalb dessen Stile statt einer zweiten Kopie.
import './TrackSessionDialog.css';

interface RouteEditDialogProps {
  title: string;
  /** Beschriftung des Namensfeldes – „Name der Route" bzw. „Name der Fahrt". */
  nameLabel: string;
  name: string;
  placeholder?: string;
  maxLength?: number;
  /**
   * Tag der Route als ISO-Datum. Nur geplante Routen haben einen; eine
   * Aufzeichnung trägt ihr Datum in der Startzeit und lässt das Feld weg.
   */
  date?: string;
  dateLabel?: string;
  /**
   * Muss ein Name stehen? Eine Aufzeichnung ohne Namen lehnt firestore.rules
   * ab; eine geplante Route darf dagegen namenlos bleiben und heißt dann in
   * der Liste „Ohne Namen".
   */
  requireName?: boolean;
  onSave: (values: { name: string; date: string }) => void;
  onCancel: () => void;
}

/**
 * Bearbeitet, was an einer Route Beschriftung ist: ihren Namen und – bei den
 * geplanten Routen – den Tag, für den sie gedacht ist.
 *
 * Bewusst ein eigener Dialog statt eines Feldes in der Liste: Umbenannt wird
 * selten und meistens am Tisch, nicht während der Fahrt; ein Dialog macht
 * dabei sichtbar, welcher Eintrag gerade gemeint ist, und lässt sich mit
 * „Abbrechen" folgenlos wieder schließen. Die Wegpunkte einer geplanten Route
 * bleiben außen vor – die werden weiterhin auf der Karte abgesteckt.
 */
export function RouteEditDialog({
  title,
  nameLabel,
  name,
  placeholder,
  maxLength,
  date,
  dateLabel,
  requireName = true,
  onSave,
  onCancel
}: RouteEditDialogProps) {
  const titleId = useId();
  const nameId = useId();
  const dateId = useId();
  const t = useT();
  const [draftName, setDraftName] = useState(name);
  const [draftDate, setDraftDate] = useState(date ?? '');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const trimmed = draftName.trim();

  return createPortal(
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog track-session-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>

        <div className="track-session-field">
          <label className="label" htmlFor={nameId}>
            {nameLabel}
          </label>
          <Input
            id={nameId}
            value={draftName}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
          />
        </div>

        {date !== undefined && (
          <div className="track-session-field">
            <label className="label" htmlFor={dateId}>
              {dateLabel}
            </label>
            <Input
              id={dateId}
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
            />
          </div>
        )}

        <div className="dialog-actions">
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            fullWidth
            disabled={requireName && !trimmed}
            onClick={() => onSave({ name: trimmed, date: draftDate })}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
