import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { initSentry } from './lib/sentry';
import { detectLanguage, translate } from './i18n/translate';
import './index.css';

initSentry();

/**
 * Fängt Abstürze ab, die React sonst mit einem leeren weißen Bildschirm
 * quittiert hätte – auf einem Boot mit schlechter Verbindung kein guter
 * Moment für eine unerklärliche leere Seite. Der Fehler geht (falls
 * konfiguriert, siehe lib/sentry.ts) an Sentry, unabhängig von dieser
 * Fallback-UI.
 */
/**
 * Liegt außerhalb von App/I18nProvider – trifft der Absturz die App selbst
 * (statt nur etwas darunter), stünde auch der Provider nicht mehr zur
 * Verfügung. Die gespeicherte Spracheinstellung wird deshalb direkt aus
 * localStorage gelesen, mit derselben Geräte-Erkennung als Rückfall wie beim
 * allerersten Start.
 */
function crashScreenLanguage() {
  try {
    const stored = JSON.parse(localStorage.getItem('boat_preferences') ?? '{}');
    if (stored.language === 'de' || stored.language === 'en') return stored.language;
  } catch {
    // Ungültiger/fehlender Stand – Geräteeinstellung entscheidet.
  }
  return detectLanguage();
}

function CrashFallback() {
  const t = translate.bind(null, crashScreenLanguage());
  return (
    <div className="boot-screen">
      <p className="page-title">{t('crash.title')}</p>
      <p className="helper-text">{t('crash.description')}</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>
        {t('crash.reload')}
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
