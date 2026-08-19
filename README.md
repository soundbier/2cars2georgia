# 2cars2georgia

Roadtrip-Logbuch (Vite + React + Firebase).

## Entwicklung

```bash
npm ci
npm run dev
npm run typecheck
npm test
```

## Zugänge eines Roadtrips

Pro Roadtrip gibt es drei technische Firebase-Auth-User mit demselben lokalen
E-Mail-Teil (der Roadtrip-ID) und unterschiedlichen Domains – die
Firestore-Regeln lesen daran ab, womit ein Gerät angemeldet ist:

| Domain | Passwort | Darf |
| --- | --- | --- |
| `@2cars2georgia.trip` | Roadtrip-Passwort (kennt die Crew) | alles im Alltag: Einträge anlegen, ändern, in den Papierkorb legen, sich selbst in die Crew eintragen |
| `@2cars2georgia.admin` | Admin-Passwort (beim Anlegen vergeben) | zusätzlich: endgültig löschen, Mitglieder entfernen, Rollen vergeben |
| `@2cars2georgia.recovery` | einmalig angezeigter Wiederherstellungscode | wie der Roadtrip-Zugang – der Weg zurück, wenn das Roadtrip-Passwort weg ist |

Der Admin-Modus wird bei Bedarf unter *Mehr → Admin-Zugang* gestartet und
bleibt bis zum Verlassen des Roadtrips aktiv. Roadtrips, die vor dieser
Funktion angelegt wurden, richten den Admin-Zugang dort einmalig ein.

Die Rollen in `settings/general` (Owner/Mitfahrer/Read-only) sind davon
unabhängig und steuern nur die Oberfläche – durchgesetzt wird ausschließlich,
was in `firestore.rules` steht.

## Firestore-Regeln veröffentlichen

`firestore.rules` liegt im Repo, wird aber von keinem Workflow ausgerollt.
Nach jeder Änderung an den Regeln – und nach jedem Feature, das neue Felder
oder Collections schreibt – müssen sie von Hand veröffentlicht werden:

```bash
npx firebase deploy --only firestore:rules
```

Wird das vergessen, sieht es in der App wie ein sporadischer Fehler aus:
Firestore wendet den Schreibvorgang zuerst lokal an (der Eintrag verschwindet,
die Erfolgsmeldung erscheint), der Server lehnt ihn ein bis zwei Sekunden
später mit `permission-denied` ab – und der Eintrag ist wieder da. Betroffen
war zuletzt das Feld `deletedAt` (Papierkorb): Solange die alten Regeln online
sind, erlauben sie es nicht, und jedes Löschen schlägt genau so fehl.
