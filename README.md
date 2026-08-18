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
