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
  'nav.settings': 'Einstellungen',
  'nav.administration': 'Administration',

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

  // --- Anmeldung (persönliches Konto, siehe lib/authAccount.ts) ----------
  'auth.signInHint': 'Mit E-Mail und Passwort anmelden.',
  'auth.signUpHint': 'Neues Konto mit E-Mail und Passwort anlegen.',
  'auth.tabSignIn': 'Anmelden',
  'auth.tabSignUp': 'Registrieren',
  'auth.emailPlaceholder': 'E-Mail-Adresse',
  'auth.passwordPlaceholder': 'Passwort',
  'auth.passwordConfirmPlaceholder': 'Passwort bestätigen',
  'auth.submitting': 'Einen Moment …',
  'auth.signInSubmit': 'Anmelden',
  'auth.signUpSubmit': 'Konto anlegen',
  'auth.orDivider': 'oder',
  'auth.google': 'Mit Google anmelden',
  'auth.forgotPassword': 'Passwort vergessen?',
  'auth.resetNeedsEmail': 'Bitte zuerst die E-Mail-Adresse eingeben.',
  'auth.resetSent': 'E-Mail zum Zurücksetzen des Passworts wurde verschickt.',
  'auth.passwordMismatch': 'Die Passwörter stimmen nicht überein.',
  'auth.verifyEmailSent':
    'Konto angelegt. Wir haben dir eine Bestätigungs-Mail geschickt – bitte bestätige die Adresse und melde dich danach an.',
  'auth.resendVerification': 'Verifizierungs-Mail erneut senden',
  'auth.resendNeedsCredentials':
    'Bitte E-Mail-Adresse und Passwort eingeben, damit wir die Mail erneut verschicken können.',
  'auth.verificationSent': 'Bestätigungs-Mail wurde erneut verschickt. Bitte auch den Spam-Ordner prüfen.',

  // --- Fehler der Anmeldung (Codes aus lib/authAccount.ts) ---------------
  'authError.invalidEmail': 'Diese E-Mail-Adresse ist ungültig.',
  'authError.emailInUse': 'Für diese E-Mail-Adresse existiert bereits ein Konto. Stattdessen anmelden?',
  'authError.weakPassword': 'Das Passwort muss mindestens {min} Zeichen haben.',
  'authError.wrongCredentials': 'E-Mail-Adresse oder Passwort ist falsch.',
  'authError.tooManyAttempts': 'Zu viele Versuche. Bitte kurz warten und erneut probieren.',
  'authError.popupClosed': 'Anmeldefenster wurde geschlossen, bevor die Anmeldung abgeschlossen war.',
  'authError.emailNotVerified':
    'Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte klicke den Link in der Bestätigungs-Mail.',
  'authError.alreadyVerified': 'Diese E-Mail-Adresse ist bereits bestätigt – du kannst dich direkt anmelden.',
  'authError.verificationFailed':
    'Die Bestätigungs-Mail konnte nicht verschickt werden. Bitte später erneut versuchen.',
  'authError.unknown': 'Da ist etwas schiefgelaufen. Bitte erneut versuchen.',

  // --- Profil / Anzeigename (siehe lib/username.ts) -----------------------
  'profile.title': 'Wie sollen wir dich nennen?',
  'profile.hint': 'Dein Anzeigename ist für die ganze Crew sichtbar und muss eindeutig sein.',
  'profile.namePlaceholder': 'Anzeigename',
  'profile.submit': 'Weiter',

  // --- Fehler beim Anzeigenamen (Codes aus lib/username.ts) --------------
  'profileError.invalidName': 'Bitte einen gültigen Anzeigenamen eingeben.',
  'profileError.nameTaken': 'Dieser Anzeigename ist bereits vergeben. Wähle einen anderen.',
  'profileError.unknown': 'Da ist etwas schiefgelaufen. Bitte erneut versuchen.',

  // --- Roadtrip erstellen/beitreten (siehe lib/membership.ts) ------------
  'trip.joinHint': 'Roadtrip-Namen oder -ID der Crew eingeben, um beizutreten.',
  'trip.createHint': 'Neuen Roadtrip anlegen – du wirst automatisch Owner.',
  'trip.tabJoin': 'Beitreten',
  'trip.tabCreate': 'Roadtrip erstellen',
  'trip.namePlaceholder': 'Roadtrip-Name, z.B. Sommertour 2026',
  'trip.joinIdPlaceholder': 'Roadtrip-Name oder -ID',
  'trip.submitting': 'Einen Moment …',
  'trip.createSubmit': 'Roadtrip anlegen',
  'trip.joinSubmit': 'Beitreten',
  'trip.startDatePlaceholder': 'Start der Reise',
  'trip.endDatePlaceholder': 'Ende der Reise',
  'trip.tripDatesHint': 'Der Reisezeitraum wird für den Speiseplan und die Tagesanzeige im Cockpit gebraucht.',
  'trip.createFootnote':
    'Nach dem Anlegen zeigen wir dir die Roadtrip-ID – die teilst du der Crew mit, damit sie beitreten kann.',
  'trip.joinFootnote':
    'Es genügt der Roadtrip-Name, den die Crew kennt. Alternativ die Roadtrip-ID vom Owner (siehe Einstellungen → Crew).',
  'trip.createdSuccess': '„{tripName}“ wurde angelegt.',
  'trip.joinSuccess': '„{tripName}“ beigetreten.',
  'trip.verifyRequiredHint':
    'Solange deine E-Mail-Adresse nicht bestätigt ist, kannst du keinem Roadtrip beitreten und keinen anlegen.',

  // --- Fehler bei Roadtrip erstellen/beitreten (Codes aus lib/membership.ts) --
  'tripError.missingName': 'Bitte einen Roadtrip-Namen bzw. eine Roadtrip-ID eingeben.',
  'tripError.invalidTripDates': 'Das Enddatum darf nicht vor dem Startdatum liegen.',
  'tripError.tripNotFound': 'Kein Roadtrip mit diesem Namen bzw. dieser ID gefunden.',
  'tripError.unknown': 'Da ist etwas schiefgelaufen. Bitte erneut versuchen.',

  'admin.requiredForPurge': 'Endgültiges Löschen ist nur dem Owner möglich.',

  // --- Roadtrip endgültig löschen (Owner-Recht, siehe lib/membership.ts) --
  'trip.deleteTitle': 'Roadtrip endgültig löschen',
  'trip.deleteHint': 'Löscht den Roadtrip inklusive aller Einträge, Ausgaben und der Crew-Liste unwiderruflich.',
  'trip.deleteButton': 'Roadtrip endgültig löschen',
  'trip.deleteConfirmTitle': '„{tripName}“ endgültig löschen?',
  'trip.deleteConfirmDescription':
    'Alle Logs, Ausgaben, Gerichte und die Crew-Liste werden unwiderruflich gelöscht. Das kann nicht rückgängig gemacht werden.',
  'trip.deleteInProgress': 'Wird gelöscht …',
  'trip.deleteFailed': 'Löschen fehlgeschlagen. Bitte erneut versuchen.',

  // --- Roadtrip-ID zum Einladen (siehe settings/CrewSettings.tsx) --------
  'recovery.copy': 'Kopieren',
  'recovery.copied': 'Kopiert',

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
  'cockpit.recording': 'Aufzeichnung läuft',
  'cockpit.recordingPaused': 'Aufzeichnung pausiert',
  'cockpit.recordingOff': 'Keine Aufzeichnung',
  'cockpit.position': 'Position',
  'cockpit.noValue': '—',
  'cockpit.north': 'N',
  'cockpit.south': 'S',
  'cockpit.east': 'O',
  'cockpit.west': 'W',
  'cockpit.addLog': 'Log hinzufügen',
  'cockpit.moreLogs': 'Weitere ({count})',
  'cockpit.fewerLogs': 'Weniger',
  'cockpit.today': 'Heute',
  'cockpit.noEntriesToday': 'Heute noch keine Einträge.',

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
  'dayRecap.emptyHint': 'Noch keine Route oder Ereignisse für diesen Roadtrip – sobald ihr loslegt, könnt ihr hier ein Tagesbild erstellen.',
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
  'settings.roadtripProtected': 'Nur für Mitglieder dieses Roadtrips sichtbar',
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
  'settings.logout': 'Konto abmelden',
  'settings.logoutFailed': 'Abmelden fehlgeschlagen. Bitte erneut versuchen.',
  'settings.leaveRoadtrip': 'Roadtrip verlassen',
  'settings.crewCount_one': '{count} Mitglied',
  'settings.crewCount_other': '{count} Mitglieder',
  'settings.quickLogCount_one': '{count} Kategorie',
  'settings.quickLogCount_other': '{count} Kategorien',

  // --- Crew-Verwaltung --------------------------------------------------
  'crew.title': 'Crew',
  'crew.subtitle': 'Wer an Bord ist und Logs erfassen kann',
  'crew.section': 'Besatzung ({count})',
  'crew.inviteTitle': 'Crew einladen',
  'crew.inviteHint': 'Diese Roadtrip-ID an die Crew weitergeben – wer sie kennt, kann beitreten.',
  'crew.removeMember': '{name} entfernen',
  'crew.self': '{name} (Du)',
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
  'crew.onlyOwnerCanManage': 'Nur Owner können Crewmitglieder entfernen oder Rollen vergeben.',
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
    'Lukas Gehrke, LukasGehrke@gmx.de; 2cars2georgia, 2cars2georgia@gmx.de ',
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
  // Einmaliger Hinweis vor dem ersten Login/App-Start, siehe PrivacyOnboarding.tsx.
  'privacy.onboardingTitle': 'Bevor es losgeht',
  'privacy.onboardingHint':
    'Bitte lest euch kurz durch, welche Daten diese App speichert, bevor ihr euch anmeldet oder die App nutzt.',
  'privacy.acknowledge': 'Verstanden, weiter',

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
  'trash.purgeFailed': 'Endgültiges Löschen fehlgeschlagen.',

  // --- Kombüse -----------------------------------------------------------
  'kombuese.sectionTitle': 'Kombüse',
  'kombuese.overviewSubtitle': 'Speiseplan, Gerichte, Einkaufsliste und Lager',
  'kombuese.mealPlan': 'Speiseplan',
  'kombuese.mealPlanValue': 'Wer isst wann was',
  'kombuese.dishes': 'Gerichte',
  'kombuese.dishesValue': 'Rezepte und Zutaten',
  'kombuese.shoppingList': 'Einkaufsliste',
  'kombuese.shoppingListValue': 'Was noch fehlt',
  'kombuese.inventory': 'Lager',
  'kombuese.inventoryValue': 'Was an Bord ist',

  'mealType.breakfast': 'Frühstück',
  'mealType.lunch': 'Mittagessen',
  'mealType.dinner': 'Abendessen',
  'mealType.all': 'Alle',

  'dishes.title': 'Gerichte',
  'dishes.subtitle': 'Rezepte mit Zutaten für den Speiseplan',
  'dishes.addDish': 'Gericht anlegen',
  'dishes.editDish': 'Gericht bearbeiten',
  'dishes.deleteDish': 'Gericht löschen',
  'dishes.namePlaceholder': 'Name des Gerichts',
  'dishes.nameRequired': 'Bitte einen Namen eingeben.',
  'dishes.notePlaceholder': 'Notiz (optional)',
  'dishes.ingredients': 'Zutaten',
  'dishes.ingredientNamePlaceholder': 'Zutat',
  'dishes.ingredientQuantityPlaceholder': 'Menge',
  'dishes.ingredientUnitPlaceholder': 'Einheit',
  'dishes.addIngredient': 'Zutat hinzufügen',
  'dishes.removeIngredient': 'Zutat entfernen',
  'dishes.ingredientCount_one': '{count} Zutat',
  'dishes.ingredientCount_other': '{count} Zutaten',
  'dishes.noIngredients': 'Noch keine Zutaten',
  'dishes.saved': 'Gericht gespeichert',
  'dishes.empty': 'Noch keine Gerichte',
  'dishes.emptyHint': 'Gerichte hier anlegen, um sie im Speiseplan zu verwenden.',
  'dishes.deleteTitle': 'Gericht löschen',
  'dishes.deleteDescription':
    'Das Gericht wandert in den Papierkorb und bleibt dort wiederherstellbar. Bereits im Speiseplan zugeordnete Tage verweisen dann auf ein gelöschtes Gericht.',
  'dishes.trashed': 'Gericht in den Papierkorb verschoben',
  'dishes.restored': 'Gericht wiederhergestellt',

  'mealPlan.title': 'Speiseplan',
  'mealPlan.subtitle': 'Geplante Mahlzeiten nach Kalendertag',
  'mealPlan.noTripDates': 'Für diesen Roadtrip ist kein Reisezeitraum hinterlegt.',
  'mealPlan.noTripDatesHint':
    'Der Speiseplan braucht Start- und Enddatum der Reise. Ohne Admin-Zugang lässt sich das hier nicht nachtragen.',
  'mealPlan.setTripDates': 'Reisezeitraum festlegen',
  'mealPlan.tripDatesSaved': 'Reisezeitraum gespeichert',
  'mealPlan.addEntry': 'Gericht zuordnen',
  'mealPlan.choosePlaceholder': 'Gericht auswählen',
  'mealPlan.noDishesForMealType': 'Noch kein Gericht für diese Mahlzeit angelegt.',
  'mealPlan.removeEntry': 'Zuordnung entfernen',
  'mealPlan.deleteTitle': 'Zuordnung entfernen',
  'mealPlan.deleteDescription': 'Das Gericht wird für diesen Tag nicht mehr geplant.',
  'mealPlan.trashed': 'Zuordnung entfernt',
  'mealPlan.restored': 'Zuordnung wiederhergestellt',
  'mealPlan.entryAdded': 'Gericht zugeordnet',

  'shoppingList.title': 'Einkaufsliste',
  'shoppingList.subtitle': 'Automatisch aus dem Speiseplan, abzüglich Lagerbestand',
  'shoppingList.fromMealPlan': 'Aus dem Speiseplan',
  'shoppingList.fromMealPlanEmpty': 'Nichts zu besorgen – der Lagerbestand deckt den Speiseplan ab.',
  'shoppingList.manual': 'Manuell hinzugefügt',
  'shoppingList.manualEmpty': 'Noch keine manuellen Posten.',
  'shoppingList.addExtra': 'Posten hinzufügen',
  'shoppingList.namePlaceholder': 'Artikel',
  'shoppingList.quantityPlaceholder': 'Menge',
  'shoppingList.unitPlaceholder': 'Einheit',
  'shoppingList.check': '„{name}“ abhaken',
  'shoppingList.uncheck': '„{name}“ wieder aufnehmen',
  'shoppingList.deleteExtra': 'Posten entfernen',
  'shoppingList.deleteTitle': 'Posten entfernen',
  'shoppingList.deleteDescription': '„{name}“ wird von der Einkaufsliste entfernt.',
  'shoppingList.trashed': 'Posten entfernt',
  'shoppingList.restored': 'Posten wiederhergestellt',

  'inventory.title': 'Lager',
  'inventory.subtitle': 'Was an Bord ist, mit Menge und Lagerort',
  'inventory.addItem': 'Posten anlegen',
  'inventory.namePlaceholder': 'Lebensmittel',
  'inventory.quantityPlaceholder': 'Menge',
  'inventory.unitPlaceholder': 'Einheit',
  'inventory.locationPlaceholder': 'Lagerort, z.B. Kühlbox',
  'inventory.increase': 'Menge erhöhen',
  'inventory.decrease': 'Menge verringern',
  'inventory.deleteItem': 'Posten löschen',
  'inventory.deleteTitle': 'Lagerposten löschen',
  'inventory.deleteDescription':
    'Der Posten wandert in den Papierkorb und bleibt dort wiederherstellbar.',
  'inventory.trashed': 'Posten in den Papierkorb verschoben',
  'inventory.restored': 'Posten wiederhergestellt',
  'inventory.empty': 'Lager ist leer',
  'inventory.emptyHint': 'Lebensmittel mit Menge und Lagerort erfassen.',
  'inventory.saved': 'Posten gespeichert',

  // --- Administration (nur für users/{uid}.role == 'admin') -------------
  'admin.title': 'Administration',
  'admin.subtitle': 'Alle Roadtrips dieser Installation',
  'admin.tripsSection': 'Roadtrips ({count})',
  'admin.owner': 'Owner: {name}',
  'admin.memberCount_one': '{count} Mitglied',
  'admin.memberCount_other': '{count} Mitglieder',
  'admin.empty': 'Noch keine Roadtrips vorhanden',
  'admin.loadError': 'Die Roadtrips konnten nicht geladen werden.',
  'admin.noAccess': 'Kein Administrationszugriff',

  'cockpit.dayOfTrip': 'Tag {day} von {total}',
  'cockpit.tripDayLabel': 'Reisetag'
} as const;

/**
 * `as const` oben hält die Schlüssel als Literale fest – die Werte sollen
 * dagegen einfach Strings sein, sonst müsste jede Übersetzung wörtlich mit dem
 * deutschen Text übereinstimmen.
 */
export type Translations = Record<keyof typeof de, string>;
