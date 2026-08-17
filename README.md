# 2cars2georgia

Eine Progressive Web App (PWA) zur Live-GPS-Verfolgung, ereignisbasierten Dokumentation und Kostenverwaltung für Bootstouren. Die Anwendung ist für den mobilen Einsatz optimiert, offline-fähig und synchronisiert alle Daten in Echtzeit über Firebase Firestore zwischen mehreren Crewmitgliedern.

## Features im Detail

* **Live-GPS-Tracking:**
    * Erfasst kontinuierlich Geolocation-Daten.
    * Visualisiert den Standort und den Routenverlauf als `Polyline` auf der Karte.
    * Berechnet in Echtzeit die aktuelle Geschwindigkeit (km/h).
    * Automatische Zentrierung der Karte auf den eigenen Standort.

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
