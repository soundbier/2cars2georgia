# Sicherheits- und Datenschutzbericht

**Projekt:** 2cars2georgia (Vite + React + Firebase, PWA)
**Stand:** 20.08.2026, Commit `87f9488` auf `main`
**Umfang:** Firestore-Sicherheitsregeln, Authentifizierung und Rollenmodell,
Client-Code (`src/`), Build-/CI-Konfiguration, Abhängigkeiten, Datenschutz
(DSGVO-Sicht) und Schutz gegen Zugriff durch Dritte.

Grundlage ist ausschließlich der Code im Repository. Nicht prüfbar waren die
Einstellungen in der Firebase Console (tatsächlich veröffentlichte Regeln,
App-Check-Enforcement, autorisierte Domains, Firestore-Region) und die
Hosting-Konfiguration – dazu liegt nichts im Repo. Die entsprechenden Punkte
sind unten als „zu verifizieren" markiert.

---

## 1. Gesamtbild

Das Fundament ist ungewöhnlich solide für ein Projekt dieser Größe: Die
Zugriffskontrolle liegt vollständig serverseitig in `firestore.rules`, es gibt
keinen rekursiven Sammel-Wildcard, jede Collection validiert Felder, Typen,
Längen und Wertebereiche, und 108 Regeltests laufen im CI gegen den Emulator.
Im Client gibt es kein `dangerouslySetInnerHTML`, kein `eval`, saubere
HTML-/XML-Maskierung im Exportbericht, selbst gehostete Schriften und keine
Secrets im Repository.

Die zentrale Schwachstelle liegt nicht in der Umsetzung, sondern im
Zugangsmodell: **Der Beitritt zu einem Roadtrip ist selbstbedienend und der
einzige „Schlüssel" dafür ist die Roadtrip-ID – ein aus dem Reisenamen
erzeugter, erratbarer Slug.** Damit hängt der Schutz aller Standort-, Kosten-
und Namensdaten an einem Geheimnis, das praktisch keines ist.

| Schwere | Anzahl |
| --- | --- |
| Hoch | 1 |
| Mittel | 7 |
| Niedrig | 8 |

---

## 2. Befunde

### H1 – Fremde Roadtrips sind über erratbare IDs beitretbar  *(hoch)*

**Fundstellen:** `firestore.rules:199`, `firestore.rules:227-237`,
`src/lib/membership.ts:28-66`, `src/lib/membership.ts:142-195`

Die Dokument-ID eines Roadtrips ist der Slug seines Namens
(`slugifyTripName`): aus „Sommertour 2026" wird `sommertour-2026`. Ein
Zufallssuffix kommt nur bei einer Kollision hinzu. Die Regeln erlauben

* `allow get: if signedIn()` auf `roadtrips/{tripId}` – jedes angemeldete
  Konto darf beliebige IDs auf Existenz prüfen und Name plus `ownerUid` lesen;
* `allow create` auf `roadtrips/{tripId}/members/{uid}` für jedes verifizierte
  Konto mit `role: 'member'` – ohne Einladung, ohne Freigabe durch den Owner,
  ohne Kenntnisnahme durch irgendjemanden.

Wer ein bestätigtes Konto anlegt (E-Mail-Verifikation genügt, jede
Wegwerf-Adresse reicht), kann damit eine Wortliste plausibler Reisenamen
durchprobieren, sich selbst als Mitglied eintragen und anschließend **alle**
Daten des Roadtrips lesen und schreiben: GPS-Spur mit Zeitstempeln
(Bewegungsprofil der Crew), Logbuch, Kosten inklusive Beträgen und Namen,
Speisepläne, geplante Routen, Fehlerprotokoll. Als `member` sind auch
Schreibzugriffe und das Verschieben von Einträgen in den Papierkorb erlaubt.
Der Owner sieht den Beitritt nur, wenn er zufällig die Crew-Liste öffnet.

Erschwerend: `joinRoadtrip` akzeptiert auch den *Klarnamen* der Reise und
slugifiziert ihn selbst – der Beitrittsweg ist auf Raten hin optimiert.

**Empfehlung (in dieser Reihenfolge):**

1. Beitritt an ein echtes Geheimnis binden statt an die Dokument-ID: ein
   Einladungs-Token mit ≥ 128 Bit Entropie, das der Owner erzeugt und das in
   den Regeln beim `members`-`create` geprüft wird (z. B. Vergleich gegen ein
   nicht listbares Feld des Roadtrip-Dokuments), idealerweise mit Ablaufdatum
   und Einmalnutzung.
2. Alternativ oder ergänzend: Beitritt erzeugt einen Antrag
   (`joinRequests/{uid}`), den erst der Owner in eine Mitgliedschaft
   überführt.
3. `allow get` auf `roadtrips/{tripId}` einschränken – ohne Token darf die
   Existenz einer ID nicht bestätigt werden.
4. Neue Roadtrips mit zufälliger ID anlegen und den Slug höchstens als
   Anzeigename führen.

---

### M1 – App Check ist optional und damit vermutlich inaktiv  *(mittel)*

**Fundstelle:** `src/firebase.ts:27-39`, `.env.example`

Ohne `VITE_RECAPTCHA_SITE_KEY` wird App Check gar nicht initialisiert. Ob der
Schlüssel im Produktions-Build gesetzt und in der Console Enforcement für Auth
und Firestore aktiviert ist, lässt sich im Repo nicht feststellen (**zu
verifizieren**). Ohne App Check gibt es gegen automatisiertes Durchprobieren –
von Anmeldedaten wie von Roadtrip-IDs (siehe H1) – nur Firebase Auths eigene
Drosselung; auf Firestore-Leseanfragen wirkt die nicht. Der clientseitige
Throttle (`src/lib/attemptThrottle.ts`) ist, wie dort korrekt dokumentiert,
gegen ein Skript wirkungslos.

**Empfehlung:** App Check verpflichtend machen (Build ohne Site-Key ablehnen)
und Enforcement in der Console einschalten.

---

### M2 – Nutzer-Enumeration über `usernames/`  *(mittel)*

**Fundstelle:** `firestore.rules:132-141`

`allow read: if signedIn()` erlaubt jedem angemeldeten Konto, die gesamte
Namensreservierung zu lesen bzw. aufzulisten – und damit Anzeigename → UID
aller registrierten Personen abzubilden. Für die einzige Funktion, die das
braucht (Ist der Name frei?), genügt ein `get`; ein `list` ist nirgends nötig.

Zusätzlich kann jedes Konto beliebig viele Namen reservieren (`create` prüft
nur `uid == request.auth.uid`), ohne Bezug zum eigenen Profil – Namensbesetzung
ist möglich, und `users/{uid}.displayName` wird nirgends gegen die Reservierung
gegengeprüft, die Eindeutigkeit gilt also nur so weit, wie der Client mitspielt.

**Empfehlung:** `list` sperren (`allow get: if signedIn();` statt `read`),
optional die Reservierung an das Anlegen des eigenen Profils koppeln.

---

### M3 – Datenschutzerklärung deckt die tatsächliche Verarbeitung nicht ab  *(mittel)*

**Fundstellen:** `src/i18n/de.ts` (Block `privacy.*`), `src/lib/sentry.ts:29-32`,
`firestore.rules:143-154`, `src/lib/mapLayers.ts`, `src/lib/errorLog.ts`

Der Hinweistext ist für ein privates Projekt bemerkenswert vollständig
(Verantwortliche Stelle, Zwecke, Rechtsgrundlage, Auftragsverarbeiter,
Speicherdauer, Betroffenenrechte). Vier Punkte stimmen aber nicht mit dem Code
überein:

1. **E-Mail-Adressen.** `privacy.dataNamesText` sagt „keine E-Mail-Adressen
   oder sonstigen Kontaktdaten". Tatsächlich speichert `users/{uid}` die
   Adresse (`firestore.rules:147-149`), und Firebase Auth hält sie ohnehin.
2. **Sentry.** `privacy.processorsText` sagt, Sentry erhalte „nur die anonyme
   Roadtrip-ID". `setSentryContext` setzt zusätzlich den Tag `crewUser` auf den
   Anzeigenamen – bei Klarnamen ist das ein Personenbezug. Fehlermeldungen und
   Stacktraces können darüber hinaus beliebige Inhalte transportieren.
3. **Kartendienste.** Jede Kachelanfrage überträgt die IP-Adresse und den
   angesehenen Kartenausschnitt – also faktisch den Aufenthaltsraum – an
   OpenStreetMap, OpenTopoMap, **Esri/ArcGIS (USA)**, CARTO, OpenSeaMap und
   waymarkedtrails. Diese Empfänger und die Drittlandsübermittlung fehlen im
   Text.
4. **Fehlerprotokoll und reCAPTCHA.** Die Collection `errors` speichert
   User-Agent, aufgerufene URL, Stacktrace und Anzeigenamen; App Check bindet
   Google reCAPTCHA v3 ein. Beides ist nicht erwähnt.

**Empfehlung:** Die vier Punkte in `privacy.*` ergänzen bzw. korrigieren und in
`setSentryContext` den Klarnamen durch die UID (oder gar nichts) ersetzen.

**Status:** Erledigt. Der Datenschutzhinweis wurde angepasst –
Konto-/E-Mail-Daten, Fehlerprotokoll, Kartendienste samt Esri/USA und
reCAPTCHA sind benannt, ebenso die Offline-Kopie auf dem Gerät. Der
Sentry-Tag `crewUser` ist inzwischen weggefallen: An Sentry gehen nur noch
die pseudonyme Firebase-UID (als `setUser`) und die Roadtrip-ID (als Tag
`roadtrip`), kein Klarname (`src/lib/sentry.ts`, festgehalten in
`src/lib/sentry.test.ts`). Der Anzeigename bleibt im Fehlerprotokoll des
Roadtrips, das in der eigenen Datenbank liegt und nur für dessen Crew lesbar
ist – der Hinweistext beschreibt genau das.

---

### M4 – Betroffenenrechte sind in der App technisch nicht umsetzbar  *(mittel)*

**Fundstellen:** `firestore.rules:140`, `firestore.rules:153`,
`firestore.rules:288`

`users/{uid}` und `usernames/{name}` erlauben weder `update` noch `delete` –
weder Berichtigung (Anzeigename ändern) noch Löschung des Profils ist
vorgesehen, auch nicht für die betroffene Person selbst. Trackpunkte darf nur
der Owner löschen; wer seine eigene GPS-Spur entfernt haben möchte, ist auf ihn
angewiesen. Der Datenschutzhinweis verweist konsequenterweise auf manuelle
Löschung durch die verantwortliche Stelle – das ist zulässig, sollte aber
bewusst so entschieden sein und nicht ein Nebeneffekt der Regeln bleiben.

**Empfehlung:** Mindestens Selbstlöschung von `users/{uid}` (mit Freigabe der
Namensreservierung) und Löschen eigener Trackpunkte über `authorId` erlauben.

---

### M5 – Keine Security-Header, keine Content Security Policy  *(mittel)*

**Fundstellen:** `firebase.json`, `index.html`

`firebase.json` enthält keinen `hosting`-Block, im Repo gibt es keine
Header-Konfiguration und `index.html` keine `<meta http-equiv>`-Policy. Damit
wird die App ohne CSP, ohne `X-Content-Type-Options`, ohne `Referrer-Policy`
und ohne `Permissions-Policy` ausgeliefert (**Auslieferungsweg zu
verifizieren**). Bei einer PWA mit Geolocation-Zugriff ist besonders
`Permissions-Policy: geolocation=(self)` sinnvoll; eine CSP begrenzt den
Schaden, falls je eine Injektionslücke entsteht.

**Empfehlung:** `hosting.headers` in `firebase.json` ergänzen, CSP mit
`default-src 'self'`, `img-src` für die Kachel-Hosts, `connect-src` für
Firebase/Sentry, `frame-ancestors 'none'`.

---

### M6 – Verwundbare Abhängigkeiten  *(mittel)*

`npm audit`: 16 Meldungen (1 kritisch, 2 hoch, 13 mittel).

| Paket | Schwere | Bewertung |
| --- | --- | --- |
| `vitest` ≤ 3.2.5 | kritisch | Nur Dev (UI-Server); im Projekt nicht genutzt, aber updaten |
| `vite` ≤ 6.4.2 | hoch | Nur Dev-Server; Path-Traversal/`fs.deny`-Bypass |
| `undici` (über `firebase` 10.12) | hoch | Betrifft den Node-Pfad des SDK, nicht das Browser-Bundle |

Kein Befund landet im ausgelieferten Bundle, das Risiko ist also gering – die
Firebase-Version (10.12, aktuell ist 12.x) ist trotzdem deutlich veraltet und
liegt hinter Fehlerbehebungen des Auth-/Firestore-SDK zurück.

**Empfehlung:** `npm audit fix`, Firebase-SDK und Vite/Vitest anheben, danach
`npm test` und `npm run test:rules`. Dependabot oder Renovate für die Zukunft.

---

### M7 – Lokal zwischengespeicherte Daten überleben die Abmeldung  *(mittel)*

**Fundstellen:** `src/firebase.ts:41-45`, `src/lib/authAccount.ts:202-208`

`persistentLocalCache` legt alle gelesenen Roadtrip-Daten in IndexedDB ab.
`signOutAccount` beendet nur die Auth-Sitzung; `clearIndexedDbPersistence` wird
nirgends aufgerufen. Auf einem geteilten oder verlorenen Gerät bleiben Logbuch,
Kosten und GPS-Spur damit nach dem Abmelden vollständig auf der Platte lesbar –
ohne erneute Anmeldung nicht in der App, aber jederzeit über die
Entwicklerwerkzeuge. Dasselbe gilt für die Offline-Kacheln in der Cache Storage
(die sind unkritisch) und für `localStorage` (Trip-ID, Einstellungen,
Kartenausschnitt – der letzte verrät den zuletzt betrachteten Ort).

**Empfehlung:** Beim Abmelden Firestore terminieren und
`clearIndexedDbPersistence` aufrufen, App-eigene `localStorage`-Schlüssel
entfernen.

---

### Niedrige Befunde

| # | Befund | Fundstelle |
| --- | --- | --- |
| L1 | **CSV-Formel-Injektion:** `escapeCsvValue` maskiert Trennzeichen und Anführungszeichen, aber nicht führende `=`, `+`, `-`, `@`. Ein Logbuch-Titel wie `=HYPERLINK(...)` wird in Excel/Calc als Formel ausgeführt. Betrifft nur Empfänger exportierter Dateien. Abhilfe: führendes `'` oder Wert in Anführungszeichen mit vorangestelltem Apostroph. | `src/lib/exportFormats.ts:22-26` |
| L2 | **Identitätsanmaßung innerhalb der Crew:** `author` ist ein freies Textfeld; `authorId` ist optional. Ein Mitglied kann Einträge unter fremdem Namen anlegen. Passt zum dokumentierten Vertrauensmodell, wird durch H1 aber gefährlicher. Abhilfe: `authorId` verpflichtend und `author` gegen `members/{uid}.displayName` prüfen. | `firestore.rules:93-95` |
| L3 | **Ressourcen-/Kostenmissbrauch:** Arrays (`waypoints` ≤ 500, `ingredients` ≤ 30, `items` ≤ 50) werden nur nach Länge geprüft, nicht nach Inhalt – Elemente dürfen beliebig groß sein (bis zum 1-MB-Dokumentlimit). Es gibt keine Schreibratenbegrenzung; ein beigetretenes Konto kann die Firestore-Rechnung treiben. | `firestore.rules:349-350, 455-467, 502-504` |
| L4 | **Verwaiste Roadtrips:** Der letzte Owner darf sich selbst entfernen (bewusst, da Regeln nicht zählen können). Danach kann niemand mehr Rollen vergeben oder den Roadtrip löschen – beitreten aber weiterhin jeder, der die ID kennt. | `firestore.rules:261` |
| L5 | **`srcdoc` ohne `sandbox`:** Der Druckbericht landet in einem iframe ohne `sandbox`-Attribut. Der Inhalt ist durchgängig maskiert, der Befund ist reine Tiefenverteidigung. | `src/lib/fileExport.ts:56-80` |
| L6 | **Fehlerprotokoll für alle Mitglieder lesbar,** inklusive User-Agent, URL und Stacktrace der Geräte anderer Crewmitglieder. Für eine private Crew vertretbar, aber mehr Geräteinformation als nötig. | `firestore.rules:519-538` |
| L7 | **Anmeldedrosselung nur pro Tab** (Reload setzt zurück) – im Code korrekt als solche dokumentiert, hier nur der Vollständigkeit halber. | `src/lib/attemptThrottle.ts` |
| L8 | **Datenschutz-Bestätigung pro Gerät** in `localStorage`, nicht am Konto – nach Browserwechsel kein Nachweis der Kenntnisnahme. Für die Haushaltsausnahme unkritisch. | `src/hooks/usePrivacyConsent.ts` |

---

## 3. Was ausdrücklich gut gelöst ist

* **Autorisierung ausschließlich serverseitig.** `lib/permissions.ts` blendet
  nur die Oberfläche; maßgeblich ist `firestore.rules`. Die Rolle steht am
  Mitgliedschaftsdokument, ohne impliziten Fallback.
* **Kein rekursiver Wildcard.** Jede Collection ist einzeln aufgeführt – eine
  neue Collection braucht eine bewusste Regeländerung.
* **Feldvalidierung durchgehend:** erlaubte Schlüssel (`hasOnly`), Typen,
  Längen, Wertebereiche, Plausibilitätsfenster für Zeitstempel.
* **108 Regeltests im CI** gegen den Firestore-Emulator, in einem eigenen Job.
* **E-Mail-Verifikation** wird serverseitig erzwungen (`emailVerified()`) und
  im Client sauber gehandhabt (`reload()` + `getIdToken(true)`).
* **Plattform-Admin-Rolle** ist nur lesend und lässt sich vom Client nicht
  setzen (`users/` erlaubt kein `update` und kein `role`-Feld beim `create`).
* **Keine Secrets im Repo**, `.env` und `dist` sind ignoriert, die
  Firebase-Web-Config ist korrekt als nicht-geheim eingeordnet.
* **Kein `dangerouslySetInnerHTML`, kein `eval`**, korrektes HTML-/XML-Escaping
  im Reisebericht und in der GPX-Ausgabe, Schriften selbst gehostet (kein
  Google-Fonts-Abruf).
* **PWA-Update mit Bestätigung** statt stillem `skipWaiting`.

---

## 4. Empfohlene Reihenfolge

1. **H1** – Beitritt an ein echtes Geheimnis oder eine Owner-Freigabe binden.
   Alles andere ist nachrangig, solange fremde Roadtrips erratbar sind.
2. **M1** – App Check verpflichtend aktivieren (bremst H1 zusätzlich aus).
3. **M2** – `list` auf `usernames/` sperren.
4. **M3** – Datenschutzhinweis korrigieren, `crewUser`-Tag in Sentry entfernen.
5. **M5/M6** – Security-Header ergänzen, Abhängigkeiten aktualisieren.
6. **M4/M7** – Selbstlöschung ermöglichen, lokalen Cache beim Abmelden leeren.
7. Niedrige Befunde nach Gelegenheit, L1 und L2 zuerst.

## 5. Offene Punkte zur Verifikation außerhalb des Repos

* Sind die Regeln aus `firestore.rules` tatsächlich veröffentlicht? (Der
  README weist zu Recht darauf hin, dass das ein manueller Schritt ist.)
* Ist App Check in der Console für Auth **und** Firestore erzwungen?
* Welche Firestore-Region wird genutzt (EU oder USA)? Der Datenschutzhinweis
  lässt beides offen.
* Wie und wo wird die App gehostet, und welche HTTP-Header setzt dieser
  Dienst?
* Sind unter Authentication → Settings nur die eigenen Domains als
  „Authorized domains" eingetragen?
