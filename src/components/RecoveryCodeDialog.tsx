import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, ShieldAlert } from 'lucide-react';
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
          Wiederherstellungscode für „{tripName}“
        </h2>
        <p className="dialog-description">
          Falls die Crew das Roadtrip-Passwort vergisst, kommt ihr nur mit diesem Code zurück an
          eure Daten. Er wird nirgends gespeichert und danach nie wieder angezeigt – jetzt sicher
          notieren (z.B. Passwort-Manager oder Papier).
        </p>

        <div className="recovery-code-box">
          <code className="recovery-code-value">{code}</code>
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        </div>

        <label className="recovery-dialog-confirm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>Ich habe den Code sicher gespeichert.</span>
        </label>

        <Button type="button" fullWidth disabled={!saved} onClick={onAcknowledge}>
          Weiter
        </Button>
      </div>
    </div>,
    document.body
  );
}
