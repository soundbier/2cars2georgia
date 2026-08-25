# Hinweise für den KI-Assistenten

* **`TODO.md` ist die Arbeitsliste.** Zu Beginn jeder Sitzung lesen. Erledigte
  Punkte dort abhaken und nach „Zuletzt erledigt" verschieben, neue Wünsche
  als offenen Punkt eintragen – im selben Commit wie die Änderung. Die
  Spielregeln stehen in der Datei selbst.
* **`README.md` erklärt das Warum.** Alles, was nicht offensichtlich ist –
  Design-Leitbild, Rollenmodell, Offline-Aufzeichnung, Karten- und
  Cockpit-Entscheidungen –, steht dort und wird dort mitgepflegt.
* **Sprache:** Oberfläche und Texte auf Deutsch und Englisch
  (`src/i18n/de.ts`, `src/i18n/en.ts`, immer beide). Kommentare, Commits und
  README auf Deutsch.
* **Vor dem Commit:** `npm run typecheck` und `npm test`. Beides muss grün
  sein, bevor ein Punkt als erledigt gilt.
