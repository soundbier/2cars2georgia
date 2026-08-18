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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info', action?: ToastAction) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, tone, action }]);
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
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'danger' && <AlertTriangle size={16} />}
            {t.tone === 'success' && <CheckCircle2 size={16} />}
            {t.tone === 'info' && <Info size={16} />}
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
