# Cloud Functions: Push-Benachrichtigungen

Der Versand der Benachrichtigungen liegt hier, weil Web Push ohne Server nicht
geht: Ein Gerät kann sich als Empfänger eintragen, aber niemand darf sich
selbst eine Meldung schicken. Die App registriert sich (siehe
`src/lib/push.ts`), diese Functions verschicken.

## Was hier läuft

| Function | Auslöser | Wirkung |
| --- | --- | --- |
| `onExpenseCreated` | neues Dokument in `expenses` | meldet die Ausgabe an die übrige Crew |
| `onEventCreated` | neues Dokument in `events` | meldet den Logbuch-Eintrag an die übrige Crew |
| `checkStalledTracking` | alle 5 Minuten | warnt, wenn eine laufende Aufzeichnung 20 Minuten keine Position mehr geliefert hat |
| `pruneStaleDevices` | täglich 04:00 | entfernt Geräte-Registrierungen, die sich seit 180 Tagen nicht gemeldet haben |

Über die eigenen Einträge wird nie benachrichtigt, und jedes Gerät abonniert
die drei Themen (`expenses`, `events`, `emergency`) einzeln.

Die reine Logik – Texte, Empfängerauswahl, Stillstandserkennung – liegt in
`src/notifications.ts` und ist bewusst frei von `firebase-admin` und
`firebase-functions`. Dadurch läuft sie im normalen `npm test` des
Hauptprojekts mit, ohne dass dieses Verzeichnis installiert sein muss.

## Voraussetzungen

1. **Blaze-Tarif.** Cloud Functions und Cloud Scheduler gibt es im kostenlosen
   Spark-Tarif nicht. Für eine Crew dieser Größe bleiben die Kosten im
   Free-Tier-Kontingent, aber ein hinterlegtes Zahlungsmittel ist Pflicht.
2. **Web-Push-Schlüssel.** Firebase Console → Projekteinstellungen → Cloud
   Messaging → *Web Push certificates* → Schlüsselpaar erzeugen. Den
   öffentlichen Schlüssel als `VITE_FIREBASE_VAPID_KEY` in die `.env` der App
   eintragen (siehe `.env.example`). Fehlt er, deaktiviert die App Push
   vollständig und weist in den Einstellungen darauf hin.

## Deployen

```sh
cd functions
npm ci
npm run deploy          # baut und deployt nur die Functions
```

Die Indizes für den Notfall-Wächter liegen in `firestore.indexes.json` und
müssen einmalig mit:

```sh
firebase deploy --only firestore:indexes
```

angelegt werden. Ohne sie schlägt die Abfrage in `checkStalledTracking` fehl –
Firebase loggt dann eine Fehlermeldung mit einem Direktlink zum Anlegen.

## Grenzen

- Auf dem iPhone funktionieren Web-Push-Benachrichtigungen erst ab iOS 16.4 und
  nur, wenn die App über „Zum Home-Bildschirm“ installiert und von dort
  gestartet wurde. Im normalen Safari-Tab meldet die Einstellungsseite, dass
  das Gerät es nicht kann.
- Die Stillstandswarnung erkennt nur, dass keine Positionen mehr ankommen. Ein
  leerer Akku und ein echter Notfall sehen für sie gleich aus – sie ersetzt
  keinen Notruf und keine Sicherheitsausrüstung.
