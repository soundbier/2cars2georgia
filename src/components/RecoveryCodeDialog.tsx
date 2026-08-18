import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, ShieldAlert } from 'lucide-react';
import { useT } from '../i18n';
import { Button } from './ui';
import './RecoveryCodeDialog.css';

interface RecoveryCodeDialogProps {
  tripName: string;
  code: string;
  onAcknowledge: () => void;
}

/**
 * Zeigt den Wiederherstellungscode genau einmal, direkt nach dem Anlegen
 * eines Roadtrips. Bewusst NICHT über Klick auf den Hintergrund oder Escape
 * schließbar (anders als ConfirmDialog) – wer den Code nicht notiert, kommt
 * bei vergessenem Passwort nicht mehr an seine Daten heran, siehe
 * src/lib/roadtrip.ts.
 */
export function RecoveryCodeDialog({ tripName, code, onAcknowledge }: RecoveryCodeDialogProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = useT();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-API kann fehlen/verweigert werden (z.B. kein HTTPS-Kontext) –
      // der Code steht ohnehin lesbar im Dialog, Abtippen bleibt möglich.
    }
  };

  return createPortal(
    <div className="dialog-overlay" role="presentation">
      <div
        className="dialog recovery-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recovery-dialog-title"
      >
        <div className="recovery-dialog-icon">
          <ShieldAlert size={22} />
        </div>
        <h2 id="recovery-dialog-title" className="dialog-title">
          {t('recovery.title', { tripName })}
        </h2>
        <p className="dialog-description">{t('recovery.description')}</p>

        <div className="recovery-code-box">
          <code className="recovery-code-value">{code}</code>
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('recovery.copied') : t('recovery.copy')}
          </Button>
        </div>

        <label className="recovery-dialog-confirm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>{t('recovery.acknowledge')}</span>
        </label>

        <Button type="button" fullWidth disabled={!saved} onClick={onAcknowledge}>
          {t('common.continue')}
        </Button>
      </div>
    </div>,
    document.body
  );
}
