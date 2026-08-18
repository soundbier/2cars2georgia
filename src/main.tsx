import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { initSentry } from './lib/sentry';
import './index.css';

initSentry();

/**
 * Fängt Abstürze ab, die React sonst mit einem leeren weißen Bildschirm
 * quittiert hätte – auf einem Boot mit schlechter Verbindung kein guter
 * Moment für eine unerklärliche leere Seite. Der Fehler geht (falls
 * konfiguriert, siehe lib/sentry.ts) an Sentry, unabhängig von dieser
 * Fallback-UI.
 */
function CrashFallback() {
  return (
    <div className="boot-screen">
      <p className="page-title">Etwas ist schiefgelaufen</p>
      <p className="helper-text">
        Die App ist abgestürzt. Ein Neuladen hilft meistens – deine Daten sind sicher in der
        Cloud gespeichert.
      </p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>
        Neu laden
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
