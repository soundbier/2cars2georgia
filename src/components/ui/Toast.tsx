import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import './Toast.css';

type ToastTone = 'info' | 'success' | 'danger';

export interface ToastAction {
  label: string;
  onAct: () => void;
}

interface ToastEntry {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  /** Läuft gerade die Ausblende-Animation (siehe .toast-leaving). */
  leaving?: boolean;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Toasts mit Aktion bleiben länger stehen: Ein „Rückgängig“ nach 3,2 Sekunden
 * wegzublenden reicht nicht, um es auf einem Handy überhaupt zu lesen.
 */
const TOAST_TIMEOUT_MS = 3200;
const TOAST_WITH_ACTION_TIMEOUT_MS = 7000;

/** Muss zur Dauer von .toast-leaving in Toast.css passen. */
const TOAST_EXIT_MS = 180;

/**
 * Mehr als drei Meldungen übereinander liest ohnehin niemand, sie würden auf
 * dem Handy aber den halben Bildschirm verdecken – die älteste weicht.
 */
const MAX_VISIBLE_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  /** Blendet aus und räumt den Eintrag erst nach der Animation weg. */
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info', action?: ToastAction) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, tone, action }].slice(-MAX_VISIBLE_TOASTS));
      setTimeout(
        () => dismiss(id),
        action ? TOAST_WITH_ACTION_TIMEOUT_MS : TOAST_TIMEOUT_MS
      );
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.tone}${t.leaving ? ' toast-leaving' : ''}`}
          >
            {t.tone === 'danger' && <AlertTriangle size={16} className="toast-icon" />}
            {t.tone === 'success' && <CheckCircle2 size={16} className="toast-icon" />}
            {t.tone === 'info' && <Info size={16} className="toast-icon" />}
            <span className="toast-message">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action!.onAct();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast muss innerhalb von ToastProvider verwendet werden');
  return ctx;
}
