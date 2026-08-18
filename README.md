# 2cars2georgia

Eine Progressive Web App (PWA) zur Live-GPS-Verfolgung, ereignisbasierten Dokumentation und Kostenverwaltung für Bootstouren. Die Anwendung ist für den mobilen Einsatz optimiert, offline-fähig und synchronisiert alle Daten in Echtzeit über Firebase Firestore zwischen mehreren Crewmitgliedern.

## Features im Detail

* **Live-GPS-Tracking:**
    * Erfasst kontinuierlich Geolocation-Daten.
    * Visualisiert den Standort und den Routenverlauf als `Polyline` auf der Karte.
    * Berechnet in Echtzeit die aktuelle Geschwindigkeit (km/h).
    * Zeigt die eigene Position als ausgerichtetes Boots-Symbol; der Kurs kommt vom Gerät oder wird aus der zurückgelegten Strecke abgeleitet.

* **Kartenbedienung:**
    * **Folgen:** Eine Taste zentriert die Karte auf die eigene Position und lässt sie mitlaufen; das Verschieben der Karte beendet das Folgen.
    * **Gemerkter Ausschnitt:** Position, Zoom und Ausrichtung überleben Tab-Wechsel und App-Neustart (`lib/mapView.ts`).
    * **Drehbar:** Zwei-Finger-Geste (am Desktop Shift + Scrollen) dreht die Karte, die Kompasstaste richtet sie wieder nach Norden aus.
    * **Ebenen:** Grundkarte (Standard, Topografisch, Satellit, Reduziert) und Overlays (Seezeichen, Radrouten, Wanderwege) in den Einstellungen wählbar – alle Quellen ohne API-Schlüssel (`lib/mapLayers.ts`).

* **Ereignis-Logbuch & Interaktive Karte:**
    * **Logging:** Schnelles Erfassen von Ereignissen (Schleuse, Pause, Panne, Grenze, Anlegen, Tanken, Pegel).
    * **Editor:** Direkte Bearbeitung von Ereignissen (Titel, Typ, Koordinaten) direkt im Karten-Popup.
    * **Visualisierung:** Farbkodierte Marker in der Karte zeigen an, welches Crewmitglied ein Ereignis geloggt hat.
    * **Statistiken:** Automatische Berechnung der zurückgelegten Gesamtdistanz (basierend auf der Haversine-Formel) und der reinen Reisezeit.

* **Kostenverwaltung:**
    * **Eingabe:** Formularbasiertes Erfassen von Ausgaben mit Betrag, Beschreibung, Kategorie und Zahler.
    * **Splitting:** Zuweisung zu einer Person oder direkt auf die "Bordkasse".
    * **Übersicht:** Dynamische Gesamtsummenberechnung in Echtzeit für volle Budget-Kontrolle.

* **System & PWA:**
    * **Echtzeit-Synchronisation:** Nahtlose Daten-Synchronisierung über **Firebase Firestore**.
    * **Crew-Management:** Zentrale Verwaltung der erlaubten Nutzer.
    * **Offline-Ready:** Als PWA mit Service Workern konfiguriert, um auch bei instabiler Internetverbindung stabil zu laufen.

* **Roadtrip-Zugriffsschutz:**
    * **Mehrere Roadtrips:** Jede Reise ist ein eigener Roadtrip mit eigenem Namen, eigenem Passwort und vollständig isolierten Daten (`roadtrips/{tripId}/…`).
    * **Passwortgeschützter Beitritt:** Nur wer Roadtrip-Name und -Passwort kennt, kommt an Position, Logbuch und Kasse – nicht mehr jeder mit dem Link.
    * **Echte Durchsetzung via Firebase Auth:** Jeder Roadtrip entspricht einem Firebase-Auth-User; Firestore-Regeln (`firestore.rules`) verlangen serverseitig eine passende Anmeldung. Ein reiner UI-Passwortscreen wäre kein echter Schutz, da die Firebase-Config im Client liegt und jeder damit direkt gegen Firestore schreiben könnte.

## Roadtrip-Auth einrichten (einmalig pro Firebase-Projekt)

1. **Email/Password-Anmeldung aktivieren:** Firebase Console → *Authentication* → *Sign-in method* → *Email/Password* aktivieren. (Es werden keine echten E-Mail-Adressen genutzt – siehe `src/lib/roadtrip.ts`.)
2. **Firestore-Regeln deployen**, damit der Schutz tatsächlich greift:
   ```bash
   npm install -g firebase-tools
   firebase deploy --only firestore:rules --project <DEIN_FIREBASE_PROJECT_ID>
   ```
   Alternativ den Inhalt von `firestore.rules` in der Firebase Console unter *Firestore Database → Regeln* einfügen.
3. Fertig – im ersten Bildschirm der App kann nun ein Roadtrip erstellt (mit selbstgewähltem Passwort) oder einem bestehenden per Name+Passwort beigetreten werden.

Zum lokalen Testen der Regeln ohne echtes Firebase-Projekt: `firebase emulators:start --only auth,firestore --project demo-2cars2georgia`.

### Wiederherstellungscode statt Passwort-Reset

Die technischen Auth-User (siehe oben) nutzen erfundene E-Mail-Adressen, Firebases
"Passwort vergessen"-Mail kann sie also nicht erreichen. Deshalb erzeugt `createRoadtrip`
zusätzlich einen **Wiederherstellungscode** – technisch ein zweiter, unabhängiger Auth-User mit
eigenem Zufallspasswort. Der Code wird einmalig direkt nach dem Anlegen angezeigt und nirgends
gespeichert; wer ihn notiert hat, kann sich damit dauerhaft anmelden, falls das normale
Roadtrip-Passwort vergessen wird (Link "Passwort vergessen?" auf dem Beitreten-Tab). Es ist kein
Reset-Mechanismus – das alte Passwort bleibt weiterhin gültig, der Code ist ein zusätzlicher,
dauerhaft gültiger Zweitschlüssel.

## Brute-Force-/Bot-Schutz (optional)

Firebase Auth drosselt Anmeldeversuche bereits von sich aus (`auth/too-many-requests`), und
`src/lib/attemptThrottle.ts` bremst wiederholte Fehlversuche zusätzlich im Browser – beides ist
aber kein Ersatz für einen echten, serverseitigen Schutz gegen ein Skript, das systematisch
Roadtrip-Namen und Passwörter durchprobiert. Dafür eignet sich **Firebase App Check**, kostenlos
auf dem Spark-Tarif nutzbar:

1. Firebase Console → *App Check* → Web-App registrieren → Anbieter **reCAPTCHA v3** → Site-Key
   erzeugen (dabei automatisch bei Google reCAPTCHA registriert).
2. Site-Key als `VITE_RECAPTCHA_SITE_KEY` in die `.env` eintragen – `src/firebase.ts`
   initialisiert App Check dann automatisch beim Start.
3. **Erst nach ein paar Tagen Beobachtung** in der Console unter *App Check* für
   *Authentication* und *Cloud Firestore* auf „Erzwingen" umstellen. Vorher zeigt die Console nur
   an, wie viele Anfragen einen gültigen Token hätten – das schützt davor, sich mit einer falschen
   Konfiguration versehentlich selbst auszusperren.

Ohne diese Variable bleibt App Check inaktiv, App und Regeln verhalten sich unverändert.

## Monitoring (optional)

Ohne weitere Konfiguration läuft die App wie zuvor, aber Fehler/Abstürze in Produktion bleiben
unsichtbar. Für [Sentry](https://sentry.io)-Fehlerberichte:

1. Kostenloses Sentry-Projekt anlegen (Plattform "React").
2. DSN aus *Project Settings → Client Keys (DSN)* als `VITE_SENTRY_DSN` in die `.env` eintragen.
3. Fertig – `src/lib/sentry.ts` initialisiert sich beim Start selbst, sobald die Variable gesetzt
   ist. Jeder Fehlerbericht trägt die (anonyme) Roadtrip-ID und den Crew-Namen als Kontext, siehe
   `setSentryContext` in `src/App.tsx`.

## Projektstruktur

```text
├── public/                  # PWA-Assets, Web-Manifest und Favicons
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── favicon.ico
│   └── site.webmanifest
├── src/                     # Quellcode
│   ├── App.tsx              # Hauptkomponente & Routing
│   ├── Costs.tsx            # Ausgabenverwaltung
│   ├── Dashboard.tsx        # Startseite & Tracking-Kontrolle
│   ├── MapTab.tsx           # Leaflet-Karte & Ereignis-Bearbeitung
│   ├── Settings.tsx         # Crew-Einstellungen & Logout
│   ├── Stats.tsx            # Statistiken & Logbuch-Übersicht
│   ├── firebase.ts          # Firebase Konfiguration
│   ├── index.css            # Globales Styling
│   ├── main.tsx             # Entry Point
│   ├── types.ts             # TypeScript Definitionen
│   └── useTracking.ts       # Custom Hook für GPS
├── .gitignore               # Git Ausschlussliste
├── .npmrc                   # NPM Konfiguration
├── README.md                # Dokumentation
├── index.html               # Basis-HTML
├── package.json             # Abhängigkeiten & Scripts
├── tsconfig.json            # TypeScript Konfiguration
└── vite.config.ts           # Vite Build-Konfiguration
