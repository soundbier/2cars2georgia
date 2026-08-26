# 2cars2georgia

Roadtrip-Logbuch (Vite + React + Firebase).

## Entwicklung

```bash
npm ci
npm run dev
npm run typecheck
npm test
```

Was als Nächstes ansteht, steht in `TODO.md` – erledigte Punkte werden dort
abgehakt und wieder entfernt. `CLAUDE.md` fasst für den KI-Assistenten
zusammen, wo er nachschlägt und was vor einem Commit laufen muss.

## Design

Leitbild ist „Instrument auf Papier": Papier trägt die ruhenden Inhalte
(Logbuch, Kosten, Crew, Einstellungen), das Instrument zeigt Laufendes
(Geschwindigkeit, GPS, aktive Aufzeichnung). Zwei Materialwelten, keine
dritte – und keine Skeuomorphie: keine Texturen, keine Alterung, kein Retro.

Alle Farben, Größen und Abstände stehen in `src/styles/tokens.css`. Die Datei
ist zweistufig aufgebaut – rohe Farbwelt, darüber die semantischen Rollen. In
Komponenten-CSS gehören ausschließlich Rollen-Tokens; ein roher Farbwert dort
bricht den späteren Nachtmodus, der genau diese Rollen überschreiben wird.

Signalfarben haben feste Bedeutungen: Terracotta = Primäraktion und Route,
Türkis = GPS/Sync/Verbindung, Oliv = Erfolg, Rost = Fehler. Farbe ist nie die
einzige Information – dazu kommen immer Symbol, Text oder Form.

Die Displayschrift (Archivo Narrow, selbst gehostet) lässt sich mit
`tools/font-preview.html` gegen Alternativen vergleichen: Die Datei zeigt die
Kandidaten in den Größen aus `tokens.css` mit echten App-Zeichenketten.

## Konten & Zugänge

Jede Person meldet sich mit einem persönlichen Firebase-Auth-Konto an
(E-Mail/Passwort oder Google, siehe `src/lib/authAccount.ts`) und legt beim
ersten Login einen eindeutigen Anzeigenamen fest (`src/lib/username.ts`,
serverseitig über `usernames/{normalizedName}` reserviert).

Ein Roadtrip ist ein Dokument unter `roadtrips/{tripId}` mit einer
Mitgliedschafts-Collection `roadtrips/{tripId}/members/{uid}`
(`src/lib/membership.ts`). Wer einen Roadtrip anlegt, wird automatisch
`owner`; alle anderen kommen nur über eine Anfrage hinein, die der Owner
freigibt (siehe unten).

| Rolle | Darf |
| --- | --- |
| `owner` | alles: Einträge anlegen/ändern/löschen, Crew verwalten (Rollen vergeben, entfernen), Roadtrip endgültig löschen |
| `member` | Einträge anlegen/ändern, in den Papierkorb legen – keine Crew-Verwaltung, kein endgültiges Löschen |
| `readonly` | nur lesen |

Durchgesetzt wird ausschließlich, was in `firestore.rules` steht – die
Rolle aus `members/{uid}` ist dort die alleinige Grundlage, nicht die
Oberfläche.

In der Firebase Console müssen unter Authentication die Anbieter
„E-Mail/Passwort" und „Google" aktiviert sein, sonst schlagen die
entsprechenden Anmeldewege fehl.

### Beitreten: anfragen, der Owner nimmt auf

Die Roadtrip-ID ist der Slug des Reisenamens – aus „Sommertour 2026" wird
`sommertour-2026`. Sie ist damit ratbar, und genau darauf lief der frühere
Beitrittsweg hinaus: Wer die ID kannte oder erriet, trug sich selbst als
Mitglied ein und konnte anschließend alles lesen und schreiben, von der
GPS-Spur bis zur Kostenabrechnung. Eine Wortliste plausibler Reisenamen
genügte (Befund H1, `docs/sicherheitsbericht-2026-08.md`).

Deshalb entsteht eine Mitgliedschaft jetzt auf genau zwei Wegen:

1. **Owner beim Anlegen.** `createRoadtrip` trägt die anlegende Person selbst
   als `owner` ein – zulässig nur, wenn sie laut `roadtrips/{tripId}.ownerUid`
   tatsächlich diejenige ist, die den Roadtrip gerade angelegt hat.
2. **Freigabe durch den Owner.** Alle anderen stellen unter ihrer eigenen UID
   einen Antrag (`roadtrips/{tripId}/joinRequests/{uid}`, `requestJoin`). Der
   Owner sieht ihn unter Einstellungen → Crew und macht daraus eine
   Mitgliedschaft (`approveJoinRequest`) oder lehnt ihn ab.

Die Roadtrip-ID ist damit kein Schlüssel mehr, sondern eine Adresse: Sie sagt
nur, wo man anklopft. Ein Antrag allein gibt keinerlei Zugriff auf die Daten –
er erlaubt genau eines, nämlich den Namen des Roadtrips zu sehen, auf den man
wartet. Dafür ist `get` auf `roadtrips/{tripId}` nicht mehr für jedes
angemeldete Konto offen, sondern nur noch für Mitglieder, für die
Plattform-Administration und für Personen mit offenem Antrag: Ohne eines von
beidem lässt sich nicht einmal bestätigen, dass es eine ID gibt.

Der Anzeigename ist dabei an den Antrag gebunden – `firestore.rules` verlangt,
dass die neue Mitgliedschaft denselben Namen trägt wie der Antrag. Der Owner
gibt frei, wer sich beworben hat, und benennt niemanden um.

Auf der Warteseite (`src/pages/RoadtripGate.tsx`) steht der gestellte Antrag,
bis er freigegeben wird; die Seite lauscht dafür auf das eigene
Mitgliedschafts-Dokument und schaltet von selbst weiter. Der Antrag überlebt
das Neuladen (localStorage) und lässt sich zurückziehen.

### E-Mail-Bestätigung

Ein neues Konto mit E-Mail/Passwort muss die Adresse bestätigen, bevor es
einem Roadtrip beitreten oder einen anlegen kann: Die Registrierung
verschickt `sendEmailVerification()` und meldet das Konto sofort wieder ab,
der Anmeldeweg lässt nur bestätigte Konten durch, und `firestore.rules`
verlangt `email_verified` beim Anlegen von `roadtrips/{tripId}` und
`roadtrips/{tripId}/members/{uid}`. Bestehende Mitgliedschaften bleiben davon
unberührt – Konten aus der Zeit davor (etwa die Administration) werden nicht
nachträglich gesperrt und müssen nicht neu angelegt werden.

Wer die Mail nicht bekommen hat, kann sie im Anmeldebereich über
„Verifizierungs-Mail erneut senden" (E-Mail + Passwort eingeben) erneut
anfordern. Nach dem Klick auf den Link genügt eine normale Anmeldung bzw.
ein Neuladen – die App holt den Status frisch vom Server.

Die Vorlage der Bestätigungs-Mail (Absender, Text, Weiterleitungs-URL) liegt
in der Firebase Console unter Authentication → Templates → „E-Mail-Adresse
bestätigen"; die App-Domain muss dort unter Authentication → Settings →
Authorized domains eingetragen sein.

## Aufzeichnung benennen

Eine Tour im Cockpit ist alles zwischen „Tour starten" und „Tour stoppen".
Beim Start bekommt sie eine Kennung, die an jedem Trackpunkt mitläuft
(`sessionId`, siehe `src/hooks/useTracking.tsx`); beim Stoppen öffnet sich das
Speichern-Fenster (`src/components/TrackSessionDialog.tsx`) mit Startzeit,
Dauer, Strecke und Punktzahl genau dieser Fahrt und einem Namensvorschlag
(„Fahrt 04.05., 09:30").

* Gespeichert wird ein Dokument unter `roadtrips/{tripId}/trackSessions/{sessionId}`
  mit Name, Start, Ende und Autor – bewusst ohne Strecke oder Dauer: Beides
  steckt in den Punkten und würde hier nur veralten.
* „Ohne Namen" verwirft nichts. Die Punkte sind längst geschrieben; sie bleiben
  dann namenlos Teil der Gesamtspur, genau wie alle Punkte aus der Zeit vor
  dieser Funktion.
* Umbenennen ist erlaubt (der Name ist Beschriftung, keine Aufzeichnung),
  endgültiges Löschen bleibt wie bei den Trackpunkten dem Owner vorbehalten.
  Beides geht nachträglich im Routenmenü (siehe unten); `firestore.rules`
  lässt beim Ändern ausschließlich das Feld `name` zu – Start, Ende, Autor
  und `authorId` müssen unverändert wiederkommen. Genau deshalb darf auch
  jemand anderes als die aufzeichnende Person einen Vertipper richtigstellen.

## Aufzeichnung ohne Netz und über Neustarts hinweg

Die Spur darf weder an einem Funkloch noch daran scheitern, dass das
Betriebssystem die App im Hintergrund abräumt. Dafür gibt es drei Teile:

**Ausgangspuffer** (`src/lib/trackBuffer.ts`). Jeder GPS-Punkt wird zuerst in
IndexedDB festgeschrieben und erst gelöscht, wenn der Server ihn bestätigt hat.
Der Puffer überlebt Neustart, App-Kill und leeren Akku. Parallel geht der
frische Punkt sofort einzeln nach Firestore – nur so steht er ohne Verzögerung
auf der Karte, offline über die Warteschlange des SDK. Beides zusammen heißt:
Was im SDK hängen bleibt, liegt trotzdem noch auf dem Gerät.

**Nachschub** (`src/lib/trackUploader.ts`). Beim Start, bei Rückkehr des Netzes,
bei Rückkehr in den Vordergrund und alle 30 Sekunden wird der Puffer in Stapeln
zu 200 Punkten hochgeladen. Die Dokument-ID eines Punktes ist
`{sessionId}_{timestamp}` – ein zweiter Anlauf trifft damit dasselbe Dokument
statt die Spur zu verdoppeln. `firestore.rules` lässt deshalb genau ein
wortgleiches Überschreiben eines Trackpunkts zu, sonst nach wie vor keine
Änderung. Ein Punkt, den der Server dauerhaft ablehnt, fliegt nach drei
Anläufen raus, damit er nicht den Rest der Fahrt blockiert.

**Laufende Aufzeichnung** (`src/lib/activeTrackSession.ts`). Dass gerade
aufgezeichnet wird, steht in localStorage – mit Kennung, Startzeit,
Pausenzustand und dem Zeitstempel des letzten Punktes. Startet die App neu,
läuft dieselbe Aufzeichnung weiter, statt still zu enden. Liegt der letzte
Punkt mehr als sechs Stunden zurück, war es kein Aussetzer, sondern das Ende
der Fahrt: Dann wird die Aufzeichnung zum Benennen angeboten.

Wie viel noch auf dem Gerät liegt, steht im Sync-Banner
(`src/components/SyncStatusBanner.tsx`) – anders als der Zähler laufender
Schreibvorgänge überlebt diese Zahl den Neustart.

### Grenze: Bildschirm aus

Ein Browser hat keine Ortung im Hintergrund. Ist der Bildschirm aus oder die
App nicht im Vordergrund, friert das Betriebssystem die Seite ein und
`watchPosition` liefert nichts mehr – keine API der Welt ändert daran etwas,
solange die App eine Web-App ist. Was dagegen getan wird:

* Während der Aufzeichnung hält die Wake-Lock-API den Bildschirm an
  (`src/hooks/useWakeLock.ts`, abschaltbar unter Einstellungen →
  Aufzeichnung). Die Sperre wird nach jeder Rückkehr in den Vordergrund neu
  angefordert.
* Kommt die App zurück, wird der Geolocation-Watcher neu aufgesetzt statt
  darauf zu hoffen, dass der eingefrorene von selbst wieder anspringt. Eine
  Aufsicht prüft alle 15 Sekunden, ob überhaupt noch Fixes ankommen, und
  startet ihn sonst neu.
* Die Aufzeichnung selbst läuft weiter: Nach dem Entsperren geht es in
  derselben Aufzeichnung weiter, die Lücke ist die Zeit im Schlaf.

Wirklich lückenlos im Hintergrund aufzeichnen könnte nur eine native Hülle
(Capacitor o.ä.) mit Hintergrund-Standortdienst. Solange es die nicht gibt,
gilt fürs Fahren: Handy angesteckt lassen und die App im Vordergrund.

## Tagesbild

Im Logbuch lässt sich ein Tag als teilbares Bild exportieren
(`src/lib/routeImage.ts`, Vorschau in `src/components/DayRecapDialog.tsx`).
Gezeichnet wird die Tagesroute, dazu jedes Logbuch-Ereignis mit dem Icon
seiner Schnell-Log-Kategorie in der Farbe seines Autors – dieselbe Zuordnung
wie im Cockpit.

* Die Symbole liegen als reine Geometrie in `src/lib/quickLogIconShapes.ts`:
  lucide-react gibt seine Pfaddaten nicht nach außen, und eine
  React-Komponente lässt sich nicht auf ein Canvas zeichnen. Kommt ein Icon
  in der Oberfläche dazu, gehört es dort ebenfalls hinein – ein Test
  vergleicht beide Listen.
* Jedes Ereignis ist eine Scheibe in der Autorenfarbe mit dem Symbol in Weiß
  darauf. Ein bloßes Strichsymbol ging auf der gemusterten Fläche unter, auch
  mit Kontur – bei 1080 px Bildbreite steht die Linie eines Icons nur zwei
  Pixel breit da. Weiß ist auf jedem Ton der Crew-Palette lesbar (siehe
  `src/lib/userColors.ts`), ein Ring im Hintergrundton trennt die Scheibe vom
  Untergrund.
* Kein Titel und keine Notiz am Symbol: Das Bild kursiert ohne App-Kontext.
* Route und Ereignisse teilen sich einen Bildausschnitt. Zuvor bekam jede
  Liste ihren eigenen – die Ereignisse landeten dadurch neben der Strecke,
  an der sie protokolliert wurden.

## Einstellungen und Routen

Die beiden Seiten außerhalb der Bottom-Navigation liegen nebeneinander statt
hintereinander: Ein Umschalter im Seitenkopf
(`src/components/SettingsSectionNav.tsx`) führt von der einen direkt zur
anderen, statt über das „Mehr"-Dropup zurück. Jeder Bereich behält seine
eigene Adresse (`/settings`, `/settings/routenplaner`), damit Zurück und
Neuladen dort landen, wo man war.

## Strecke und Dauer im Cockpit

„Wie weit, wie lange" hat unterwegs drei Antworten, und das Instrument zeigt
immer nur eine davon – welche, sagt der Umschalter darunter
(`src/pages/Dashboard.tsx`):

* **Aktuelle Route** – die laufende Aufzeichnung, herausgelöst über die
  Kennung, die jeder Trackpunkt mitträgt (`pointsOfSession`). Diese Wahl steht
  nur da, solange aufgezeichnet wird; endet die Aufzeichnung, fällt die
  Anzeige auf den Tag zurück, statt dauerhaft 0 zu zeigen.
* **Heute** – der ganze Kalendertag in der Zeitzone des Geräts
  (`pointsOfDay`), also auch dann vollständig, wenn er aus zwei oder drei
  Routen mit Pausen dazwischen besteht. Das ist die Vorauswahl: die Zahl, die
  unterwegs am häufigsten gesucht wird, und die es auch ohne laufende
  Aufzeichnung gibt.
* **Gesamt** – die Gesamtspur des Roadtrips.

Der Umschalter steht auf dem Papier zwischen Instrument und Tasten – das
Instrument bleibt ein Ablesegerät ohne Bedienelemente. Im Fahrmodus fehlt er;
dort sagt ein Zusatz an der Beschriftung, welche der drei Zahlen gerade
dasteht.

Eine eigene Tagesansicht unter den Einstellungen gab es dafür einmal; sie ist
weggefallen, weil das Cockpit die Tageszahl jetzt selbst zeigt. Wer einen
zurückliegenden Tag sucht, findet ihn im Logbuch, das Tagesbild dazu ebenfalls
dort (`src/components/DayRecapDialog.tsx`).

## Statistik

Unter Mehr → Statistik (`src/pages/Statistics.tsx`) steht die Auswertung, die
das Cockpit unterwegs nicht leisten kann: der Blick zurück. Ganz oben wählt ein
Umschalter den Ausschnitt, und jede Zahl darunter beantwortet ihre Frage für
genau diesen:

* **Gesamt** – die ganze Spur des Roadtrips.
* **Tag** – ein Kalendertag, gewählt aus der Liste der Reisetage
  (`groupByDay`, `src/lib/dayRecap.ts`).
* **Fahrt** – eine benannte Aufzeichnung, herausgelöst über die Kennung an
  jedem Trackpunkt (`pointsOfSession`, `src/lib/trackSession.ts`). Ereignisse
  tragen keine solche Kennung – sie werden der Fahrt über ihre Zeit
  zugeordnet.

Die beiden Ranglisten am Seitenende („Tage im Vergleich", „Aufgezeichnete
Fahrten") stehen nur im Gesamtblick und sind zugleich der Weg hinein: Ein
Tippen auf eine Zeile stellt den Ausschnitt oben darauf um.

Gerechnet wird alles in `src/lib/statistics.ts`, gespeichert nichts davon.
Eine mitgeschriebene Kennzahl veraltet, sobald ein Punkt nachträglich aus dem
Offline-Puffer eintrifft (`src/lib/trackBuffer.ts`) – die gerechnete nicht.
Drei Entscheidungen dort sind erklärungsbedürftig:

* **Fahrzeit gegen Standzeit.** Ein Abschnitt zählt als gefahren, wenn seine
  aus Weg und Zeit gerechnete Geschwindigkeit über `MOVING_THRESHOLD_KMH`
  (2 km/h) liegt. Darunter liegt kein Weg, sondern das Zittern des Empfängers:
  Ein Boot am Steg erzeugt weiter Punkte, die ein paar Meter auseinanderliegen.
  Ohne diese Schwelle wäre jede Pause Fahrzeit und „Ø in Fahrt" wertlos.
* **Höchsttempo aus dem Messwert.** Anders als die Fahrzeit kommt die Spitze
  aus dem Feld `speedKmh`, das der Empfänger geliefert hat – das ist die
  Geschwindigkeit, die tatsächlich in Firestore steht, und über einen
  30-Sekunden-Abschnitt gemittelt wäre sie keine Spitze mehr.
* **Strecke je Person getrennt.** Die Spur enthält die Punkte aller Geräte
  ineinander verschachtelt. Erst nach Autor gruppieren, dann messen – sonst
  entstünde bei jedem Wechsel zwischen zwei Fahrzeugen ein Sprung quer über die
  Landkarte.

Der Geschwindigkeitsverlauf (`src/components/SpeedChart.tsx`) wird vorher auf
höchstens ein paar hundert Werte eingedampft (`speedSeries`): Eine Tagesfahrt
im 10-Sekunden-Takt hat tausende Punkte, von denen auf Handybreite nichts zu
erkennen wäre. Gemittelt wird über gleich große Abschnitte, damit die Form der
Kurve bleibt; die Spitze geht dabei nicht verloren, sie steht als eigene
Kennzahl daneben.

Die Seite liest nur. Deshalb gibt es keine Rechteprüfung – ein
Read-only-Mitglied sieht dieselbe Auswertung – und keine neuen Collections
oder Felder in `firestore.rules`.

## Toiletten

Unter Mehr → Toiletten (`src/pages/Toilets.tsx`) stehen der Zähler und die
Karte der eingetragenen Stopps – bewusst als eigener Tab und nicht im Logbuch.
Das Logbuch ist die Chronik, die man abends durchblättert und als Tagesbild
teilt; diese Einträge tauchen deshalb weder unter den Ereignissen noch auf dem
Kartentab, im Tagesbild, in der Statistik oder im Export auf. Sie leben
ausschließlich auf dieser Seite.

Gespeichert wird in **zwei** Collections, und das ist der Kern der Sache:

* **`roadtrips/{tripId}/toiletStops`** – der Marker: Zeit, Ort, Autor und die
  Art der Örtlichkeit (Tankstelle, Restaurant, Wald, Campingplatz …). Für die
  ganze Crew lesbar, denn genau das nützt gemeinsam: Wo gab es unterwegs
  überhaupt eine Toilette?
* **`roadtrips/{tripId}/toiletDetails`** – die Beschreibung nach der
  Bristol-Stuhlformen-Skala (Typ 1–7), unter derselben Dokument-Id. Lesen und
  Schreiben darf sie ausschließlich die Person, die sie eingetragen hat.

Die Teilung ist keine Vorliebe, sondern Firestore: Leserechte gelten pro
Dokument, nicht pro Feld. Stünde der Bristol-Typ im selben Dokument wie der
Marker, wäre er für jedes Crewmitglied mitlesbar – auch wenn die Oberfläche ihn
verstecken würde. Aus derselben Regel folgt, dass die App die Beschreibungen
nur gefiltert abfragen darf (`where('authorId', '==', uid)`, siehe
`src/hooks/useToiletStops.ts`): Eine Abfrage über die ganze Collection würde
fremde Dokumente treffen und wird komplett abgelehnt. Beide Richtungen sind in
`tests/rules/firestore.rules.test.ts` abgedeckt, inklusive der Probe, dass auch
der Owner nicht in eine fremde Beschreibung sehen kann.

Zwei Schreibvorgänge statt einer Transaktion: Marker und Beschreibung liegen in
verschiedenen Collections und entstehen oft ohne Netz. Firestore wendet beide
sofort lokal an und schickt sie einzeln nach; bliebe die Beschreibung dabei auf
der Strecke, steht der Marker eben unbeschrieben da.

Eingetragen wird auf zwei Wegen: „Hier eintragen" nimmt die aktuelle
GPS-Position, „Auf Karte setzen" macht den nächsten Tipp auf die Karte zum
Eintrag – für alles, was erst abends nachgetragen wird. Danach endet der
Setzmodus wieder, sonst legte der nächste Tipp gleich den nächsten Eintrag an.
Eigene Marker lassen sich verschieben; geändert wird ansonsten im Popup, samt
Koordinatenfeldern wie auf dem Kartentab.

Gelöscht wird weich wie überall (`deletedAt`, siehe `src/lib/trash.ts`): Der
Stopp wandert in den Papierkorb und ist über den Rückgängig-Toast sofort und
unter Einstellungen → Papierkorb noch 30 Tage zurückzuholen. Dort steht nur der
Marker mit Örtlichkeit, Tag und Autor – die Beschreibung liest der Papierkorb
gar nicht erst; sie hängt still an ihrer Id und wird beim endgültigen Löschen
mit entfernt (Firestore kaskadiert nicht von selbst).

Die Skala selbst steht in `src/lib/toiletStops.ts`, zusammen mit den Zählungen.
Gerechnet wird auch hier alles beim Anzeigen, gespeichert nichts – aus
demselben Grund wie in der Statistik. Die Einordnung in „eher fest / im Rahmen /
eher weich" ist genau das und keine Diagnose.

Nach dem Einspielen dieser Änderung müssen die Firestore-Regeln veröffentlicht
werden (siehe unten) – ohne sie lehnt der Server beide neuen Collections ab.

## Karte: Ereignisse und Knopfgrößen

Beides steht unter Einstellungen → Karte, nicht als weiterer Knopf auf der
Karte selbst – es sind Entscheidungen, die man einmal trifft, und der
Kartenrand ist bereits belegt:

* **Ereignisse auf der Karte** (`showMapEvents`) blendet die Schnell-Logs als
  Marker aus. Nach ein paar Tagen liegen Dutzende davon auf der Strecke und
  verdecken das, worauf man gerade schaut. Ausblenden löscht nichts – die
  Ereignisse stehen weiter im Logbuch und auf dem Tagesbild.
* **Größe der Ereignisse** (`mapEventSize`) und **Größe der Kartenknöpfe**
  (`mapControlSize`) haben je drei Stufen, klein bis groß. Unterwegs geht es
  um „größer als jetzt", nicht um Pixelwerte; die Maße dahinter stehen in
  `src/pages/MapTab.tsx`. Die Knopfgröße geht als CSS-Variable
  (`--map-control-size`) an die Knopfgruppe, die Markergröße schreibt
  `dotIcon` inline ans Element – die Kantenlänge in `MapTab.css` ist der
  Ausgangswert.

Die Größenwahl für die Marker steht nur da, solange die Marker eingeschaltet
sind. Alle drei liegen wie die übrigen Anzeigeeinstellungen im localStorage
(`src/hooks/usePreferences.tsx`): Es sind Entscheidungen dieses Geräts, keine
der Crew.

## Routenmenü

Unter Mehr → Routen stehen die beiden Arten von Route nebeneinander, weil sie
im Kopf dasselbe sind und in den Daten nicht:

* **Geplante Routen** (`roadtrips/{tripId}/plannedRoutes`) sind Absicht –
  von Hand abgesteckte Wegpunkte, siehe „Offline-Karten“ weiter unten.
* **Aufgezeichnete Fahrten** (`roadtrips/{tripId}/trackSessions`) sind
  Vergangenheit – benannt beim Stoppen der Tour.

Beide lassen sich nachträglich über denselben Dialog umbenennen
(`src/components/RouteEditDialog.tsx`): bei der geplanten Route Name und Tag,
bei der Fahrt nur der Name. Umbenannt wird aus der Liste heraus, ohne dass die
Karte aufgeht – abgesteckt wird weiterhin auf der Karte, das ist ein eigener
Knopf.

Für die Fahrten war das bis dahin gar nicht möglich: Die Dokumente wurden
einmal beim Speichern geschrieben und danach von keiner Seite mehr gelesen –
ein Vertipper blieb für immer stehen. Jetzt liest sie
`src/hooks/useTrackSessions.ts`; Dauer und Strecke stehen nicht im Dokument,
sondern kommen aus den Trackpunkten mit derselben Kennung (einmal gruppiert in
`sessionStatsById`, `src/lib/trackSession.ts`).

Gelöscht wird in beiden Listen weich: Route und Fahrt wandern in den
Papierkorb (`deletedAt`, siehe `src/lib/trash.ts`), sind über den
Rückgängig-Toast sofort und unter Einstellungen → Papierkorb noch 30 Tage
zurückzuholen. Endgültig entfernt sie erst der Papierkorb, und das darf nur
der Owner. Der Grund ist derselbe wie bei Logbuch und Bordkasse: Der
Löschen-Knopf sitzt auf dem Telefon direkt neben dem Stift, und eine
abgesteckte Route ist eine Stunde Arbeit.

Bei einer Fahrt betrifft das ohnehin nur die Beschriftung: Die aufgezeichneten
Punkte bleiben in jedem Fall Teil der Gesamtspur, auch nach dem endgültigen
Löschen – sie sind Aufzeichnung, der Eintrag ist nur ihr Name.

## App Check

App Check ist der einzige Schutz gegen ein Skript, das die App gar nicht erst
öffnet: reCAPTCHA v3 bestätigt Firebase, dass eine Anfrage aus der echten App
kommt. Ohne ihn bremst nur die Drosselung von Firebase Auth, und die wirkt
ausschließlich auf Anmeldeversuche – Firestore-Leseanfragen laufen ungebremst
durch. Der clientseitige Throttle (`src/lib/attemptThrottle.ts`) hilft
dagegen nicht: Er läuft im Browser, den ein Angreifer nicht benutzt.

Der Site-Key war bisher optional. Fehlte er, lief der Build durch und die App
ging ohne Bot-Schutz online, ohne dass irgendwo etwas davon stand. Deshalb
bricht ein Produktions-Build ohne `VITE_RECAPTCHA_SITE_KEY` jetzt ab
(`vite.config.ts`, `src/lib/appCheckConfig.ts`) – ein vergessener Schlüssel
soll nicht wie ein normaler Build aussehen. `npm run dev` bleibt davon
unberührt: Lokal gibt es nichts zu schützen. Für einen Build, der
nachweislich nie ausgeliefert wird – etwa den Build-Durchlauf im CI –, gibt es
`APP_CHECK_OPTIONAL=1`.

Der Build allein genügt aber nicht. Zwei Schritte in der Firebase Console
gehören dazu, und beide sind, wie das Veröffentlichen der Regeln, von Hand zu
machen:

1. **App registrieren:** App Check → Apps → Web-App → Anbieter reCAPTCHA v3.
   Den Site-Key in die Build-Umgebung als `VITE_RECAPTCHA_SITE_KEY` eintragen.
2. **Enforcement einschalten:** App Check → APIs → für **Firestore und
   Authentication** erzwingen. Ohne diesen Schritt sammelt Firebase nur
   Statistik und lässt weiterhin jede Anfrage durch – die App liefert dann
   zwar Tokens, niemand verlangt sie aber.

Vor dem Erzwingen lohnt der Blick auf die Metriken in der Console: Sie zeigen,
wie viele Anfragen bereits ein gültiges Token mitbringen. Erst wenn dort im
Wesentlichen alles verifiziert ist, sperrt das Erzwingen niemanden aus, der
dazugehört.

Für die lokale Entwicklung mit gesetztem Site-Key schaltet `src/firebase.ts`
im Dev-Modus den Debug-Token an: Firebase loggt beim Start einen Token, der
einmalig in der Console unter App Check → Apps → Debug-Tokens hinterlegt wird.

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

## Offline-Karten

Die Karte lädt Kacheln weiterhin von den Diensten aus `src/lib/mapLayers.ts`.
Zusätzlich lassen sich Bereiche entlang der Route für die Fahrt ohne Netz
mitnehmen:

* Unter Mehr → Routen (`src/pages/RoutePlanner.tsx`) lassen sich Routen
  je Tag anlegen, benennen, kopieren und abstecken: Ein Tipp auf die Karte
  setzt einen Wegpunkt, Punkte lassen sich ziehen, ein Tipp darauf entfernt
  sie wieder. Genau eine Route ist aktiv – sie wird auf dem Kartentab
  gezeichnet und für den Download verwendet.
* Die Routen gehören zum Roadtrip (`roadtrips/{tripId}/plannedRoutes`, siehe
  `src/hooks/usePlannedRoutes.ts`): Am Rechner vorbereitete Routen sind auf
  jedem Gerät der Crew da, und geladen wird dort, wo die Karten gebraucht
  werden. Dank `persistentLocalCache` stehen sie auch ohne Netz bereit, sobald
  sie einmal geladen waren. Nur die Auswahl der aktiven Route bleibt lokal
  (`src/lib/plannedRoute.ts`) – auf zwei Booten sind das zwei verschiedene.
  Früher gerätelokal gespeicherte Routen wandern beim ersten Start
  automatisch in den Roadtrip.
* Der Knopf mit der Download-Wolke auf der Karte öffnet den Downloadmodus.
  Grundlage ist die aktive geplante Route, sobald sie mindestens zwei
  Wegpunkte hat; sonst der aufgezeichnete Track.
* Aus der Route entsteht ein Korridor (±12 km), zerlegt in Rasterfelder –
  jedes Feld ist genau eine Kachel der Zoomstufe 11 (`src/lib/tileGrid.ts`),
  also rund 13–20 km Kantenlänge. Gewählte Felder sind terracotta, bereits
  geladene türkis markiert.
* Der Download holt für jedes gewählte Feld die Zoomstufen 6–14 der aktiven
  Grundkarte und aller eingeschalteten Overlays (~90 Kacheln je Feld und
  Ebene) und legt sie in der Cache Storage ab (`src/lib/offlineTiles.ts`).
  Welche Felder vorliegen, steht in localStorage – der Bestand ist eine
  Eigenschaft des Geräts, nicht des Roadtrips.
* `src/components/OfflineTileLayer.tsx` ersetzt `TileLayer` und sieht vor
  jedem Netzzugriff im Speicher nach. Ohne Verbindung wird gar nicht erst
  angefragt; nicht geladene Bereiche erscheinen schraffiert statt leer.
  Route, Marker und Popups kommen aus Firestore und bleiben davon unberührt.

Grenzen der Dienste: Die Nutzungsbedingungen von OpenStreetMap erlauben nur
maßvolles Vorabladen kleiner Gebiete – deshalb der Korridor statt eines
Flächendownloads und Zoom 14 als Untergrenze. OpenTopoMap und die
Waymarked-Trails-Overlays liefern nur bis Zoom 17/18 eigene Kacheln, was für
den Offline-Bereich ohne Bedeutung ist. Antworten ohne CORS-Header werden
opak gespeichert: als Bild nutzbar, aber nicht auslesbar.
