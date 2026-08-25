/**
 * Kennzahl und Balkenzeile – die beiden Bausteine jeder Auswertung.
 *
 * Herausgezogen aus pages/Statistics.tsx, als der Toiletten-Tab (pages/Toilets.tsx)
 * dieselben Zahlen zeigen sollte: eine Reihe Kennzahlen oben, darunter eine
 * Rangliste mit Balken. Zwei Seiten mit demselben Aussehen, aber eigenem
 * Markup wären genau der Anfang, an dem sie auseinanderlaufen.
 */

import { ReactNode } from 'react';
import './StatTile.css';

interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}

/** Eine Kennzahl. Kein eigenes Papier – die Kacheln teilen sich die Fläche der Seite. */
export function StatTile({ icon, label, value, hint }: StatTileProps) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-icon">{icon}</span>
      <div className="stat-tile-value mono-num">{value}</div>
      <div className="label stat-tile-label">{label}</div>
      {hint && <div className="helper-text stat-tile-hint">{hint}</div>}
    </div>
  );
}

interface BarRowProps {
  label: ReactNode;
  value: string;
  /** Anteil am größten Wert der Liste, 0…1 – die Länge des Balkens. */
  ratio: number;
  hint?: string;
  onSelect?: () => void;
}

/**
 * Eine Zeile mit Balken – für Ranglisten (Tage, Fahrten, Crew, Kategorien).
 *
 * Der Balken liegt hinter der Zeile statt daneben: Auf Handybreite bleibt für
 * eine eigene Balkenspalte kein Platz, und die Zahl soll trotzdem am Rand
 * ausgerichtet stehen bleiben.
 */
export function BarRow({ label, value, ratio, hint, onSelect }: BarRowProps) {
  const content = (
    <>
      <span className="stat-bar-fill" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
      <span className="stat-bar-label">
        {label}
        {hint && <span className="helper-text stat-bar-hint">{hint}</span>}
      </span>
      <span className="stat-bar-value mono-num">{value}</span>
    </>
  );

  if (!onSelect) return <div className="stat-bar">{content}</div>;
  return (
    <button type="button" className="stat-bar stat-bar-button" onClick={onSelect}>
      {content}
    </button>
  );
}
