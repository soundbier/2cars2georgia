# Aufgaben

Die Arbeitsliste des Projekts – für den KI-Assistenten und für uns. Sie steht
im Repo, damit jede Sitzung an derselben Liste weiterarbeitet, statt sie im
Chatverlauf zu suchen: Was hier unter „Offen" steht, ist zu tun; was erledigt
ist, verschwindet wieder.

## Spielregeln

* **Zuerst lesen.** Zu Beginn einer Sitzung diese Datei lesen. Ohne
  ausdrücklichen Auftrag gilt der oberste offene Punkt als der nächste –
  gearbeitet wird trotzdem nur an dem, was die Person gerade verlangt.
* **Abhaken beim Erledigen.** Fertig heißt: Haken setzen (`- [x]`) und den
  Punkt nach „Zuletzt erledigt" verschieben, mit dem Kurzhash des Commits.
  Das passiert im selben Commit wie die Änderung selbst.
* **Alt wird gelöscht.** Unter „Zuletzt erledigt" stehen höchstens die letzten
  fünf Punkte. Ältere werden ersatzlos gestrichen – ihre Geschichte steht im
  Git-Log und, wenn sie erklärungsbedürftig ist, im README.
* **Fertig ist fertig.** Ein Punkt wird erst abgehakt, wenn `npm run
  typecheck` und `npm test` durchlaufen und der Stand gepusht ist.
* **Neues kommt ans Ende.** Neue Wünsche als eigener Punkt unter „Offen",
  in eigenen Worten und mit dem Warum, nicht nur dem Was. Ein Punkt, der ohne
  Rückfrage bearbeitet werden kann, ist gut formuliert.
* **Offene Fragen bleiben Fragen.** Was noch entschieden werden muss, kommt
  unter „Zu entscheiden" – dort wird nichts gebaut, bevor die Person geantwortet
  hat.

## Offen

* [ ] Weitere Befunde aus `docs/sicherheitsbericht-2026-08.md` abarbeiten, in
      der dort empfohlenen Reihenfolge (Abschnitt 4): M1 (App Check
      verpflichtend), M2 (`list` auf `usernames/` sperren), M3
      (Datenschutzhinweis korrigieren, `crewUser`-Tag in Sentry entfernen),
      M5/M6 (Security-Header, Abhängigkeiten), M4/M7 (Selbstlöschung, lokalen
      Cache beim Abmelden leeren), danach die niedrigen Befunde. Der Bericht
      ist vom Stand `87f9488` – vor jedem Punkt prüfen, ob er inzwischen
      erledigt ist. H1 ist erledigt (siehe unten).
* [ ] Nachtmodus: Die Rollen-Tokens in `src/styles/tokens.css` sind dafür
      vorbereitet (rohe Farbwelt unten, Rollen darüber). Fehlt noch die zweite
      Belegung der Rollen und ein Schalter dafür in den Einstellungen.

## Zu entscheiden

* Sollen sich die Ereignis-Marker zusätzlich direkt auf der Karte ein- und
  ausblenden lassen, oder bleibt es bei der Einstellung unter Einstellungen →
  Karte? Der Kartenrand trägt bereits vier Knöpfe.

## Zuletzt erledigt

* [x] H1: Beitritt zu einem Roadtrip an die Freigabe durch den Owner binden,
      statt an die erratbare Roadtrip-ID
* [x] Toiletten: Zähler und Karte, Beschreibung privat (`f08f3e8`)
* [x] Statistik: Roadtrip, Tag oder Fahrt auswerten (`e64b37a`)
* [x] Karte: Ereignisse ausblenden, Marker und Knöpfe in drei Größen
      (`e5c1354`)
* [x] Cockpit: Strecke und Dauer für Route, Tag oder Gesamt (`33a6280`)
