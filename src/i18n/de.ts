/**
 * Deutsche Texte – die Referenzsprache dieser App.
 *
 * Flache Schlüssel mit Punkt-Gruppierung statt verschachtelter Objekte: Damit
 * ist `keyof typeof de` direkt der Typ aller Schlüssel, ohne rekursive
 * Typmagie, und ein Tippfehler fällt beim Übersetzen sofort auf.
 *
 * Platzhalter stehen in geschweiften Klammern: `{name}`.
 *
 * Zählabhängige Texte tragen die Endungen `_one` und `_other` und werden über
 * `t('key', { count })` aufgelöst (siehe i18n/index.tsx). Neue Sprachen mit
 * mehr als zwei Pluralformen bräuchten zusätzliche Endungen – Deutsch und
 * Englisch kommen mit diesen beiden aus.
 */
export const de = {
  // --- Sprachen ---------------------------------------------------------
  'language.de': 'Deutsch',
  'language.en': 'Englisch',

  // --- Absturz-Bildschirm (main.tsx, außerhalb von I18nProvider) --------
  'crash.title': 'Etwas ist schiefgelaufen',
  'crash.description':
    'Die App ist abgestürzt. Ein Neuladen hilft meistens – deine Daten sind sicher in der Cloud gespeichert.',
  'crash.reload': 'Neu laden',

  // --- Navigation -------------------------------------------------------
  'nav.cockpit': 'Cockpit',
  'nav.map': 'Karte',
  'nav.logbook': 'Logbuch',
  'nav.costs': 'Kasse',
  'nav.more': 'Mehr',

  // --- Allgemein --------------------------------------------------------
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.confirm': 'Bestätigen',
  'common.delete': 'Löschen',
  'common.remove': 'Entfernen',
  'common.back': 'Zurück',
  'common.close': 'Schließen',
  'common.continue': 'Weiter',
  'common.saveError': 'Fehler beim Speichern.',
  'common.deleteError': 'Fehler beim Löschen.',
  'common.restoreFailed': 'Wiederherstellen fehlgeschlagen.',
  'common.writeRejected': 'Vom Server abgelehnt – Firestore-Regeln nicht aktuell?',
  'common.undo': 'Rückgängig',
  'common.connecting': 'Verbinde mit Server …',

  // --- Crew-Anmeldung ---------------------------------------------------
  'crewGate.title': 'Wer ist an Bord?',
  'crewGate.hint': 'Gerät einem Crewmitglied zuordnen, um Position und Logs zu erfassen.',
  'crewGate.firstMemberHint':
    'Dieser Roadtrip hat noch keine Crew. Trag dich als erstes Mitglied ein – du verwaltest die Crew danach.',
  'crewGate.firstMemberLabel': 'Dein Name',
  'crewGate.newHere': 'Neu dabei? Trag dich ein',
  'crewGate.namePlaceholder': 'Name',
  'crewGate.join': 'Beitreten',
  'crewGate.nameTaken': '{name} ist bereits an Bord – oben auswählen.',
  'crewGate.joinFailed': 'Beitreten fehlgeschlagen.',

  // --- Roadtrip-Gate ----------------------------------------------------
  'gate.joinHint': 'Roadtrip-Namen und Passwort der Crew eingeben, um beizutreten.',
  'gate.createHint': 'Neuen Roadtrip anlegen und ein Passwort für die Crew festlegen.',
  'gate.tabJoin': 'Beitreten',
  'gate.tabCreate': 'Roadtrip erstellen',
  'gate.namePlaceholder': 'Roadtrip-Name, z.B. Sommertour 2026',
  'gate.passwordPlaceholder': 'Passwort',
  'gate.recoveryCodePlaceholder': 'Wiederherstellungscode',
  'gate.passwordConfirmPlaceholder': 'Passwort bestätigen',
  'gate.submitting': 'Einen Moment …',
  'gate.createSubmit': 'Roadtrip anlegen',
  'gate.recoverySubmit': 'Mit Code anmelden',
  'gate.joinSubmit': 'Beitreten',
  'gate.usePassword': 'Doch mit normalem Passwort beitreten',
  'gate.useRecoveryCode': 'Passwort vergessen? Mit Wiederherstellungscode anmelden',
  'gate.createFootnote':
    'Nach dem Anlegen zeigen wir dir einmalig einen Wiederherstellungscode – damit kommt ihr auch dann noch rein, wenn das Passwort mal vergessen wird.',
  'gate.joinFootnote':
    'Das Passwort teilst du der Crew z.B. persönlich oder per Chat mit – nur damit können andere diesem Roadtrip beitreten und Einträge sehen oder ändern.',
  'gate.throttled': 'Zu viele Fehlversuche. Bitte {seconds} Sekunden warten.',
  'gate.passwordMismatch': 'Die Passwörter stimmen nicht überein.',
  'gate.recoverySuccess': 'Über Wiederherstellungscode angemeldet',
  'gate.joinSuccess': 'Roadtrip beigetreten',

  // --- Fehler der Anmeldung (Codes aus lib/roadtrip.ts) -----------------
  'authError.nameTaken':
    'Dieser Roadtrip-Name ist bereits vergeben. Wähle einen anderen Namen oder tritt dem bestehenden Roadtrip bei.',
  'authError.wrongCredentials': 'Roadtrip-Name oder Passwort ist falsch.',
  'authError.tooManyAttempts': 'Zu viele Versuche. Bitte kurz warten und erneut probieren.',
  'authError.unknown': 'Da ist etwas schiefgelaufen. Bitte erneut versuchen.',
  'authError.missingName': 'Bitte einen Namen für den Roadtrip eingeben.',
  'authError.passwordTooShort': 'Das Passwort muss mindestens {min} Zeichen haben.',
  'authError.adminPasswordSameAsTrip':
    'Das Admin-Passwort muss sich vom Roadtrip-Passwort unterscheiden – sonst kennt es die ganze Crew.',
  'authError.adminAlreadyExists': 'Für diesen Roadtrip ist bereits ein Admin-Passwort eingerichtet.',
  'gate.adminPasswordPlaceholder': 'Admin-Passwort',
  'gate.adminPasswordHint':
    'Zweites, eigenes Passwort für endgültiges Löschen und das Verwalten der Crew. Nicht an alle weitergeben.',
  'admin.title': 'Admin-Zugang',
  'admin.subtitle': 'Endgültiges Löschen und Crew verwalten',
  'admin.active': 'Admin-Modus aktiv',
  'admin.activeHint':
    'Dieses Gerät darf endgültig löschen und die Crew verwalten. Zum Beenden den Roadtrip verlassen und normal wieder anmelden.',
  'admin.enterHint':
    'Mit dem Admin-Passwort anmelden, um endgültig zu löschen oder die Crew zu verwalten.',
  'admin.passwordPlaceholder': 'Admin-Passwort',
  'admin.start': 'Admin-Modus starten',
  'admin.entered': 'Admin-Modus aktiv',
  'admin.setUpTitle': 'Noch kein Admin-Passwort?',
  'admin.setUpHint':
    'Roadtrips, die vor dieser Funktion angelegt wurden, haben noch keinen Admin-Zugang. Wer das Roadtrip-Passwort kennt, kann ihn hier einmalig einrichten – am besten sofort, denn danach ist er belegt.',
  'admin.setUp': 'Admin-Zugang einrichten',
  'admin.setUpSuccess': 'Admin-Zugang eingerichtet – dieses Gerät ist jetzt im Admin-Modus.',
  'admin.requiredForPurge': 'Endgültiges Löschen ist nur im Admin-Modus möglich.',
  'admin.requiredForCrew': 'Mitglieder entfernen und Rollen vergeben ist nur im Admin-Modus möglich.',

  // --- Wiederherstellungscode ------------------------------------------
  'recovery.title': 'Wiederherstellungscode für „{tripName}“',
  'recovery.description':
    'Falls die Crew das Roadtrip-Passwort vergisst, kommt ihr nur mit diesem Code zurück an eure Daten. Er wird nirgends gespeichert und danach nie wieder angezeigt – jetzt sicher notieren (z.B. Passwort-Manager oder Papier).',
  'recovery.copy': 'Kopieren',
  'recovery.copied': 'Kopiert',
  'recovery.acknowledge': 'Ich habe den Code sicher gespeichert.',

  // --- Cockpit ----------------------------------------------------------
  'cockpit.title': 'Cockpit',
  'cockpit.signedInAs': 'Angemeldet als {name}',
  'cockpit.gpsActive': 'GPS aktiv',
  'cockpit.gpsSearching': 'Suche Satelliten …',
  'cockpit.gpsUnsupported': 'Geolocation nicht unterstützt',
  'cockpit.startTour': 'Tour starten',
  'cockpit.stopTour': 'Tour stoppen',
  'cockpit.pauseTour': 'Pausieren',
  'cockpit.resumeTour': 'Fortsetzen',
  'cockpit.tourPaused': 'Pausiert',
  'cockpit.quickLogs': 'Schnell-Logs',
  'cockpit.noQuickLogs': 'Keine Schnell-Logs konfiguriert',
  'cockpit.noQuickLogsHint': 'Unter Mehr → Schnell-Logs Kategorien anlegen.',
  'cockpit.waitingForGps': 'Warte auf GPS-Signal …',
  'cockpit.logged': '„{title}“ protokolliert',

  // --- Karte ------------------------------------------------------------
  'map.currentPosition': 'Aktuelle Position ({name})',
  'map.unfollow': 'Position nicht mehr folgen',
  'map.centerOnPosition': 'Auf eigene Position zentrieren',
  'map.orientNorth': 'Karte nach Norden ausrichten',
  'map.noPosition': 'Noch keine GPS-Position verfügbar.',
  'map.editEvent': 'Ereignis bearbeiten',
  'map.editButton': 'Bearbeiten',
  'map.invalidCoordinates': 'Ungültige Koordinaten.',
  'map.latitude': 'Breitengrad',
  'map.longitude': 'Längengrad',
  'map.eventUpdated': 'Ereignis aktualisiert',
  'map.eventTrashed': 'Ereignis in den Papierkorb verschoben',
  'map.eventRestored': 'Ereignis wiederhergestellt',
  'map.deleteEventTitle': 'Ereignis löschen',
  'map.deleteEventDescription':
    'Der Eintrag wandert in den Papierkorb und lässt sich unter Mehr → Papierkorb wiederherstellen.',

  // --- Logbuch ----------------------------------------------------------
  'logbook.title': 'Logbuch',
  'logbook.subtitle': 'Strecke, Dauer und Ereignisse der Reise',
  'logbook.distance': 'Strecke',
  'logbook.duration': 'Dauer',
  'logbook.events': 'Ereignisse ({count})',
  'logbook.empty': 'Noch keine Einträge',
  'logbook.emptyHint': 'Ereignisse über die Schnell-Logs im Cockpit erfassen.',
  'logbook.titlePlaceholder': 'Titel',
  'logbook.titleRequired': 'Titel darf nicht leer sein.',
  'logbook.eventUpdated': 'Ereignis aktualisiert',
  'logbook.eventTrashed': 'Ereignis in den Papierkorb verschoben',
  'logbook.eventRestored': 'Ereignis wiederhergestellt',
  'logbook.deleteTitle': 'Ereignis löschen',
  'logbook.deleteDescription':
    'Der Eintrag wandert in den Papierkorb und lässt sich unter Mehr → Papierkorb wiederherstellen.',
  'logbook.editEvent': 'Ereignis bearbeiten',
  'logbook.deleteEvent': 'Ereignis löschen',

  'dayRecap.openButton': 'Tagesbild erstellen',
  'dayRecap.title': 'Tagesübersicht',
  'dayRecap.exportButton': 'Teilen',
  'dayRecap.noTrackHint': 'Für diesen Tag liegt noch keine Route vor – das Bild zeigt nur die Kennzahlen.',
  'dayRecap.background': 'Hintergrund',
  'dayRecap.background.reduced': 'Reduziert',
  'dayRecap.background.standard': 'Standard',
  'dayRecap.background.satellite': 'Satellit',

  // --- Reisekasse -------------------------------------------------------
  'costs.title': 'Reisekasse',
  'costs.subtitle': 'Ausgaben der Crew erfassen und im Blick behalten',
  'costs.total': 'Gesamtausgaben',
  'costs.history': 'Verlauf',
  'costs.empty': 'Noch keine Ausgaben',
  'costs.emptyHint': 'Die erste Ausgabe der Reise oben eintragen.',
  'costs.descriptionPlaceholder': 'Beschreibung, z.B. Diesel',
  'costs.descriptionShort': 'Beschreibung',
  'costs.amountPlaceholder': 'Betrag in €',
  'costs.submit': 'Eintragen',
  'costs.sharedPayer': 'Bordkasse',
  'costs.self': 'Ich ({name})',
  'costs.descriptionRequired': 'Beschreibung darf nicht leer sein.',
  'costs.invalidAmount': 'Ungültiger Betrag.',
  'costs.expenseUpdated': 'Ausgabe aktualisiert',
  'costs.expenseTrashed': 'Ausgabe in den Papierkorb verschoben',
  'costs.expenseRestored': 'Ausgabe wiederhergestellt',
  'costs.editExpense': 'Ausgabe bearbeiten',
  'costs.deleteExpense': 'Ausgabe löschen',
  'costs.deleteTitle': 'Ausgabe löschen',
  'costs.deleteDescription':
    'Der Eintrag wandert in den Papierkorb und lässt sich unter Mehr → Papierkorb wiederherstellen.',
  'costs.category.verpflegung': 'Verpflegung',
  'costs.category.tanken': 'Tanken',
  'costs.category.liegeplatz': 'Liegeplatz',
  'costs.category.schleuse': 'Schleuse',
  'costs.category.sonstiges': 'Sonstiges',

  // --- Ausgleich (Reisekasse) --------------------------------------------
  'settlement.title': 'Ausgleich',
  'settlement.nothingToSettle':
    'Bisher wurde alles direkt aus der Bordkasse bezahlt – es gibt nichts zu verrechnen.',
  'settlement.nothingToSettleShort': 'Nichts zu verrechnen',
  'settlement.youGet': 'Du bekommst {amount}',
  'settlement.youOwe': 'Du schuldest {amount}',
  'settlement.youAreEven': 'Ausgeglichen',
  'settlement.laidOutAndShare': '{paid} ausgelegt · {share} Anteil',
  'settlement.allSettled': 'Alle Salden sind bereits ausgeglichen.',
  'settlement.sharedNote': '{amount} wurden direkt aus der {payer} bezahlt und bleiben außen vor.',

  // --- Einstellungen ----------------------------------------------------
  'settings.title': 'Einstellungen',
  'settings.subtitle': 'Gerät, Anzeige und Daten dieser Reise',
  'settings.thisRoadtrip': 'Dieser Roadtrip',
  'settings.roadtripProtected': 'Nur mit Roadtrip-Passwort erreichbar',
  'settings.thisDevice': 'Dieses Gerät',
  'settings.signedInProfile': 'Angemeldetes Profil',
  'settings.liveSync': 'Live-Sync',
  'settings.offline': 'Offline',
  'settings.onlineNote': 'Änderungen werden sofort mit der Crew synchronisiert.',
  'settings.offlineNote':
    'Änderungen werden lokal gespeichert und synchronisiert, sobald wieder Empfang besteht.',
  'settings.display': 'Anzeige',
  'settings.units': 'Einheiten',
  'settings.unitsDescription': 'Geschwindigkeit und Strecke in der ganzen App',
  'settings.language': 'Sprache',
  'settings.languageDescription': 'Sprache der Oberfläche auf diesem Gerät',
  'settings.map': 'Karte',
  'settings.baseLayer': 'Grundkarte',
  'settings.layerNote':
    'Ebenen liegen übereinander – die Grundkarte unten, jedes aktive Overlay darüber.',
  'settings.recording': 'Aufzeichnung',
  'settings.trackPoints': 'Trackpunkte',
  'settings.trackPointsDescription':
    'Seltener spart Akku und mobile Daten, häufiger zeichnet genauer auf.',
  'settings.interval10s': 'Alle 10 Sekunden',
  'settings.interval30s': 'Alle 30 Sekunden',
  'settings.interval60s': 'Jede Minute',
  'settings.interval300s': 'Alle 5 Minuten',
  'settings.management': 'Verwaltung',
  'settings.data': 'Daten',
  'settings.export': 'Export',
  'settings.exportValue': 'Bericht als PDF, CSV und GPX',
  'settings.trash': 'Papierkorb',
  'settings.trashValue': 'Gelöschtes wiederherstellen',
  'settings.legal': 'Rechtliches',
  'settings.privacy': 'Datenschutz',
  'settings.privacyValue': 'GPS, Namen und Kosten',
  'settings.app': 'App',
  'settings.version': 'Version',
  'settings.logout': 'Profil abmelden',
  'settings.leaveRoadtrip': 'Roadtrip verlassen',
  'settings.crewCount_one': '{count} Mitglied',
  'settings.crewCount_other': '{count} Mitglieder',
  'settings.quickLogCount_one': '{count} Kategorie',
  'settings.quickLogCount_other': '{count} Kategorien',

  // --- Crew-Verwaltung --------------------------------------------------
  'crew.title': 'Crew',
  'crew.subtitle': 'Wer an Bord ist und Logs erfassen kann',
  'crew.section': 'Besatzung ({count})',
  'crew.newNamePlaceholder': 'Neuer Name',
  'crew.addMember': 'Crewmitglied hinzufügen',
  'crew.removeMember': '{name} entfernen',
  'crew.self': '{name} (Du)',
  'crew.alreadyAboard': '{name} ist bereits an Bord.',
  'crew.cannotRemoveSelf': 'Du kannst dich nicht selbst löschen.',
  'crew.removed': '{name} entfernt',
  'crew.removeTitle': 'Crewmitglied entfernen',
  'crew.removeDescription':
    '{name} wird aus der Crew-Liste gelöscht. Bereits erfasste Logs und Ausgaben bleiben erhalten.',
  'crew.role.owner': 'Owner',
  'crew.role.member': 'Mitfahrer',
  'crew.role.readonly': 'Nur Lesen',
  'crew.roleLabel': 'Rolle von {name}',
  'crew.roleUpdated': '{name} ist jetzt {role}.',
  'crew.onlyOwnerCanManage': 'Nur Owner können Crewmitglieder einladen, entfernen oder Rollen vergeben.',
  'crew.lastOwnerRequired': 'Mindestens ein Owner muss übrig bleiben.',
  'crew.readonlyHint': 'Nur-Lesen-Zugriff: Ansehen ist möglich, Ändern nicht.',

  // --- Schnell-Logs -----------------------------------------------------
  'quickLogs.title': 'Schnell-Logs',
  'quickLogs.subtitle': 'Kategorien für die Ereignis-Buttons im Cockpit',
  'quickLogs.newCategory': 'Neue Kategorie',
  'quickLogs.labelPlaceholder': 'Bezeichnung, z. B. Wasser tanken',
  'quickLogs.addCategory': 'Kategorie hinzufügen',
  'quickLogs.addHint': 'Symbol und Bezeichnung erscheinen im Cockpit und im Logbuch.',
  'quickLogs.categories': 'Kategorien ({count})',
  'quickLogs.empty': 'Keine Schnell-Logs',
  'quickLogs.emptyHint': 'Füge oben die erste Kategorie hinzu.',
  'quickLogs.chooseIcon': 'Symbol wählen',
  'quickLogs.iconLabel': 'Symbol {name}',
  'quickLogs.edit': '{label} bearbeiten',
  'quickLogs.delete': '{label} löschen',
  'quickLogs.saveEdit': 'Änderung speichern',
  'quickLogs.removed': 'Schnell-Log entfernt',
  'quickLogs.removeTitle': 'Schnell-Log entfernen',
  'quickLogs.removeDescription':
    '„{label}“ wird aus den Schnell-Logs entfernt. Bereits erfasste Ereignisse bleiben erhalten.',
  // Voreingestellte Kategorien beim allerersten Start eines Roadtrips.
  // Danach sind es normale, von der Crew änderbare Daten in Firestore.
  'quickLogs.default.schleuse': 'Schleuse',
  'quickLogs.default.pause': 'Pause',
  'quickLogs.default.anlegen': 'Anlegen',
  'quickLogs.default.grenze': 'Grenze',
  'quickLogs.default.panne': 'Panne',

  // --- Kartenebenen -----------------------------------------------------
  'layer.osm': 'Standard',
  'layer.osm.description': 'OpenStreetMap – Orte, Straßen, Wasserwege',
  'layer.topo': 'Topografisch',
  'layer.topo.description': 'OpenTopoMap – Höhenlinien und Gelände',
  'layer.satellite': 'Satellit',
  'layer.satellite.description': 'Esri World Imagery – Luftbild ohne Beschriftung',
  'layer.light': 'Reduziert',
  'layer.light.description': 'Heller, kontrastarmer Hintergrund – Track und Marker treten hervor',
  'layer.seamarks': 'Seezeichen',
  'layer.seamarks.description': 'Tonnen, Leuchtfeuer und Fahrwasser (OpenSeaMap)',
  'layer.cycling': 'Radrouten',
  'layer.cycling.description': 'Ausgeschilderte Radfernwege (Waymarked Trails)',
  'layer.hiking': 'Wanderwege',
  'layer.hiking.description': 'Markierte Wanderwege an Land (Waymarked Trails)',
  'layer.showOnMap': '{label} auf der Karte anzeigen',

  // --- Sync und Updates -------------------------------------------------
  'sync.syncing': 'Wird synchronisiert … ({count})',
  'sync.offlineQueued': 'Offline gespeichert, wird bei Empfang synchronisiert ({count})',
  'update.title': 'Update verfügbar',
  'update.description':
    'Es gibt eine neue Version von 2cars2georgia. Ein kurzer Neustart lädt sie – bereits erfasste Daten bleiben erhalten.',
  'update.confirm': 'Jetzt aktualisieren',
  'update.later': 'Später',
  'update.offlineReady': 'App ist bereit für die Offline-Nutzung.',

  // --- Datenschutz ------------------------------------------------------
  'privacy.title': 'Datenschutz',
  'privacy.subtitle': 'Was diese App speichert und warum',
  'privacy.intro':
    'Diese App wird privat im Freundeskreis betrieben, nicht gewerblich. Trotzdem verarbeitet sie Standort-, Namens- und Kostendaten der Crew – deshalb hier transparent, was womit passiert.',
  'privacy.controller': 'Verantwortliche Stelle',
  'privacy.controllerPlaceholder':
    '[Name/Kontakt der Person eintragen, die diesen Roadtrip bzw. das Firebase-Projekt betreibt – z.B. „Vorname Nachname, E-Mail“.]',
  'privacy.dataTitle': 'Welche Daten werden verarbeitet',
  'privacy.dataGps': 'Standort (GPS):',
  'privacy.dataGpsText':
    'nur während eine Tour aktiv aufgezeichnet wird („Tour starten“ im Cockpit) – Koordinaten, Geschwindigkeit und Kurs, jeweils mit Zeitstempel und dem Namen des Geräts/Crewmitglieds.',
  'privacy.dataLog': 'Ereignis-Logbuch:',
  'privacy.dataLogText':
    'Ort, Zeitpunkt, Kategorie (z.B. Schleuse, Pause) und der Name, wer den Eintrag angelegt hat.',
  'privacy.dataCosts': 'Kosten:',
  'privacy.dataCostsText':
    'Beträge, Beschreibung, Kategorie und wer bezahlt bzw. eingetragen hat.',
  'privacy.dataNames': 'Crew-Namen:',
  'privacy.dataNamesText':
    'selbst gewählte Namen der Mitfahrenden, keine E-Mail-Adressen oder sonstigen Kontaktdaten.',
  'privacy.dataLocal': 'Technisch, lokal auf dem Gerät:',
  'privacy.dataLocalText':
    'der gewählte Crew-Name (`localStorage`), die Spracheinstellung und die Firebase-Anmeldesitzung des Roadtrips – keine Werbe-/Tracking-Cookies.',
  'privacy.purposeTitle': 'Zweck und Rechtsgrundlage',
  'privacy.purposeText':
    'Die Verarbeitung dient ausschließlich der gemeinsamen Organisation und Dokumentation dieser Reise durch die Crew selbst (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO – Erfüllung der gemeinsam vereinbarten Nutzung bzw. berechtigtes Interesse an der Reiseplanung). Bei rein privater, familiärer Nutzung im engen Freundeskreis kann zusätzlich die Haushaltsausnahme (Art. 2 Abs. 2 lit. c DSGVO) einschlägig sein. Diese Einschätzung ersetzt keine Rechtsberatung – bei Nutzung außerhalb eines engen, privaten Kreises empfiehlt sich eine anwaltliche Prüfung.',
  'privacy.processorsTitle': 'Wer die Daten sonst noch sieht',
  'privacy.processorsText':
    'Die Daten liegen bei Google Firebase (Firestore-Datenbank, Authentifizierung) als technischem Auftragsverarbeiter; je nach gewählter Firestore-Region können Server auch außerhalb der EU (z.B. USA) stehen. Ist Sentry für Fehler-Monitoring konfiguriert (siehe README), erhält auch Sentry technische Fehlerberichte – dabei bewusst ohne Standort-, Namens- oder Kostendaten, nur die anonyme Roadtrip-ID als Kontext.',
  'privacy.retentionTitle': 'Speicherdauer',
  'privacy.retentionText':
    'Daten bleiben gespeichert, solange der Roadtrip in Firebase besteht – es gibt aktuell keine automatische Löschung. Auf Wunsch löscht die verantwortliche Stelle (siehe oben) einzelne Einträge oder den gesamten Roadtrip manuell.',
  'privacy.retentionTrashText':
    'Gelöschte Logbuch-Einträge und Ausgaben landen zunächst im Papierkorb (Mehr → Papierkorb) und sind dort weiterhin gespeichert, damit ein Fehlgriff rückgängig gemacht werden kann. Endgültig entfernt werden sie erst, wenn sie dort gelöscht oder der Papierkorb geleert wird.',
  'privacy.exportTitle': 'Export und Weitergabe',
  'privacy.exportText':
    'Über Mehr → Export lassen sich Logbuch, Kosten und Route als PDF, CSV oder GPX aus der App holen. Diese Dateien enthalten Namen, Positionen und Beträge der Crew und verlassen mit dem Teilen den Schutzbereich der App – die Weitergabe an Dritte sollte deshalb mit allen Betroffenen abgestimmt sein.',
  'privacy.rightsTitle': 'Eure Rechte',
  'privacy.rightsText':
    'Ihr habt das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung eurer Daten sowie auf Datenübertragbarkeit und Widerspruch. Wendet euch dafür an die oben genannte verantwortliche Stelle. Außerdem besteht ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde.',
  // Nur in übersetzten Fassungen sichtbar, siehe en.ts.
  'privacy.translationNote': '',

  // --- Export -------------------------------------------------------------
  'export.title': 'Export',
  'export.subtitle': 'Route, Logbuch und Kosten sichern oder teilen',
  'export.reportSection': 'Reisebericht',
  'export.reportHint':
    'Öffnet den Druckdialog mit Logbuch, Reisekasse und Ausgleich. Dort „Als PDF sichern“ wählen, um den Bericht zu behalten oder zu verschicken.',
  'export.reportButton': 'Bericht als PDF',
  'export.rawDataSection': 'Rohdaten',
  'export.rawDataHint':
    'CSV öffnet sich in jeder Tabellenkalkulation, GPX in Karten-Apps wie OsmAnd, Komoot oder Google Earth.',
  'export.eventsButton': 'Logbuch als CSV ({count})',
  'export.expensesButton': 'Reisekasse als CSV ({count})',
  'export.trackButton': 'Route als GPX ({count} Punkte)',
  'export.noteSection': 'Hinweis',
  'export.noteText':
    'Auf dem Handy öffnet sich das Teilen-Menü des Systems, am Rechner wird die Datei heruntergeladen. Exportierte Dateien enthalten Namen, Positionen und Beträge der Crew – nur weitergeben, wenn alle einverstanden sind.',
  'export.failed': 'Export fehlgeschlagen.',
  'export.saved': 'Datei gespeichert',
  'export.shared': 'Datei geteilt',
  'export.defaultTripName': 'Roadtrip',

  // --- Papierkorb -----------------------------------------------------
  'trash.title': 'Papierkorb',
  'trash.subtitle': 'Gelöschte Ereignisse und Ausgaben wiederherstellen',
  'trash.section': 'Gelöscht ({count})',
  'trash.empty': 'Papierkorb ist leer',
  'trash.emptyHint_one': 'Gelöschte Einträge landen hier und bleiben {count} Tag wiederherstellbar.',
  'trash.emptyHint_other':
    'Gelöschte Einträge landen hier und bleiben {count} Tage wiederherstellbar.',
  'trash.restore': '„{title}“ wiederherstellen',
  'trash.restored': 'Eintrag wiederhergestellt',
  'trash.restoreFailed': 'Wiederherstellen fehlgeschlagen.',
  'trash.purgeOne': '„{title}“ endgültig löschen',
  'trash.daysLeft_one': 'noch {count} Tag',
  'trash.daysLeft_other': 'noch {count} Tage',
  'trash.expired': 'Aufbewahrung abgelaufen',
  'trash.cleanupSection': 'Aufräumen',
  'trash.expiredNote_one': '{count} Eintrag liegt länger als {days} Tage im Papierkorb.',
  'trash.expiredNote_other': '{count} Einträge liegen länger als {days} Tage im Papierkorb.',
  'trash.retentionNote':
    'Einträge bleiben {days} Tage wiederherstellbar. Endgültiges Löschen lässt sich nicht rückgängig machen.',
  'trash.emptyTrashButton': 'Papierkorb leeren',
  'trash.purgeAllTitle': 'Papierkorb leeren',
  'trash.purgeOneTitle': 'Endgültig löschen',
  'trash.purgeAllDescription_one':
    'Der {count} Eintrag im Papierkorb wird unwiderruflich entfernt.',
  'trash.purgeAllDescription_other':
    'Alle {count} Einträge im Papierkorb werden unwiderruflich entfernt.',
  'trash.purgeOneDescription': '„{title}“ wird unwiderruflich entfernt.',
  'trash.purgedOne': 'Eintrag endgültig gelöscht',
  'trash.purgedMany': '{count} Einträge endgültig gelöscht',
  'trash.purgeFailed': 'Endgültiges Löschen fehlgeschlagen.'
} as const;

/**
 * `as const` oben hält die Schlüssel als Literale fest – die Werte sollen
 * dagegen einfach Strings sein, sonst müsste jede Übersetzung wörtlich mit dem
 * deutschen Text übereinstimmen.
 */
export type Translations = Record<keyof typeof de, string>;
