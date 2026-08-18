import { PageHeader, Section } from '../components/ui';
import './Settings.css';
import './Privacy.css';

/**
 * Reiner Inhalt ohne Navigations-Chrome, damit er sowohl innerhalb des
 * Routers (Privacy, Standard-Export unten) als auch im router-losen
 * RoadtripGate (dort als einfaches Overlay, siehe RoadtripGate.tsx)
 * verwendet werden kann.
 */
export function PrivacyContent() {
  return (
    <div className="privacy-content">
      <p className="helper-text privacy-intro">
        Diese App wird privat im Freundeskreis betrieben, nicht gewerblich. Trotzdem verarbeitet
        sie Standort-, Namens- und Kostendaten der Crew – deshalb hier transparent, was womit
        passiert.
      </p>

      <Section title="Verantwortliche Stelle">
        <p className="helper-text privacy-placeholder">
          [Name/Kontakt der Person eintragen, die diesen Roadtrip bzw. das Firebase-Projekt
          betreibt – z.B. „Vorname Nachname, E-Mail“.]
        </p>
      </Section>

      <Section title="Welche Daten werden verarbeitet">
        <ul className="privacy-list">
          <li>
            <strong>Standort (GPS):</strong> nur während eine Tour aktiv aufgezeichnet wird
            („Tour starten“ im Cockpit) – Koordinaten, Geschwindigkeit und Kurs, jeweils mit
            Zeitstempel und dem Namen des Geräts/Crewmitglieds.
          </li>
          <li>
            <strong>Ereignis-Logbuch:</strong> Ort, Zeitpunkt, Kategorie (z.B. Schleuse, Pause)
            und der Name, wer den Eintrag angelegt hat.
          </li>
          <li>
            <strong>Kosten:</strong> Beträge, Beschreibung, Kategorie und wer bezahlt bzw.
            eingetragen hat.
          </li>
          <li>
            <strong>Crew-Namen:</strong> selbst gewählte Namen der Mitfahrenden, keine
            E-Mail-Adressen oder sonstigen Kontaktdaten.
          </li>
          <li>
            <strong>Technisch, lokal auf dem Gerät:</strong> der gewählte Crew-Name
            (`localStorage`) und die Firebase-Anmeldesitzung des Roadtrips – keine
            Werbe-/Tracking-Cookies.
          </li>
        </ul>
      </Section>

      <Section title="Zweck und Rechtsgrundlage">
        <p className="helper-text">
          Die Verarbeitung dient ausschließlich der gemeinsamen Organisation und Dokumentation
          dieser Reise durch die Crew selbst (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO – Erfüllung
          der gemeinsam vereinbarten Nutzung bzw. berechtigtes Interesse an der Reiseplanung). Bei
          rein privater, familiärer Nutzung im engen Freundeskreis kann zusätzlich die
          Haushaltsausnahme (Art. 2 Abs. 2 lit. c DSGVO) einschlägig sein. Diese Einschätzung
          ersetzt keine Rechtsberatung – bei Nutzung außerhalb eines engen, privaten Kreises
          empfiehlt sich eine anwaltliche Prüfung.
        </p>
      </Section>

      <Section title="Wer die Daten sonst noch sieht">
        <p className="helper-text">
          Die Daten liegen bei <strong>Google Firebase</strong> (Firestore-Datenbank,
          Authentifizierung) als technischem Auftragsverarbeiter; je nach gewählter
          Firestore-Region können Server auch außerhalb der EU (z.B. USA) stehen. Ist Sentry für
          Fehler-Monitoring konfiguriert (siehe README), erhält auch Sentry technische
          Fehlerberichte – dabei bewusst ohne Standort-, Namens- oder Kostendaten, nur die
          anonyme Roadtrip-ID als Kontext.
        </p>
      </Section>

      <Section title="Speicherdauer">
        <p className="helper-text">
          Daten bleiben gespeichert, solange der Roadtrip in Firebase besteht – es gibt aktuell
          keine automatische Löschung. Auf Wunsch löscht die verantwortliche Stelle (siehe oben)
          einzelne Einträge oder den gesamten Roadtrip manuell.
        </p>
      </Section>

      <Section title="Eure Rechte">
        <p className="helper-text">
          Ihr habt das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der
          Verarbeitung eurer Daten sowie auf Datenübertragbarkeit und Widerspruch. Wendet euch
          dafür an die oben genannte verantwortliche Stelle. Außerdem besteht ein
          Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde.
        </p>
      </Section>
    </div>
  );
}

/** Innerhalb des Routers verwendete Variante mit Zurück-Navigation, siehe App.tsx. */
export default function Privacy() {
  return (
    <div className="settings-page">
      <PageHeader title="Datenschutz" subtitle="Was diese App speichert und warum" backTo="/settings" />
      <PrivacyContent />
    </div>
  );
}
