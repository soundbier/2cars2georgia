import { Translations } from './de';

/**
 * Englische Texte.
 *
 * Der Typ `Translations` kommt aus de.ts: Fehlt hier ein Schlüssel oder ist
 * einer zu viel, schlägt der Typecheck fehl. Neue Texte können damit nicht
 * versehentlich einsprachig bleiben.
 */
export const en: Translations = {
  // --- Languages --------------------------------------------------------
  'language.de': 'German',
  'language.en': 'English',

  // --- Crash screen (main.tsx, outside I18nProvider) --------------------
  'crash.title': 'Something went wrong',
  'crash.description':
    'The app has crashed. Reloading usually helps – your data is safely stored in the cloud.',
  'crash.reload': 'Reload',

  // --- Navigation -------------------------------------------------------
  'nav.cockpit': 'Cockpit',
  'nav.map': 'Map',
  'nav.logbook': 'Log',
  'nav.costs': 'Kitty',
  'nav.more': 'More',

  // --- Common -----------------------------------------------------------
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.remove': 'Remove',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.continue': 'Continue',
  'common.saveError': 'Could not save.',
  'common.deleteError': 'Could not delete.',
  'common.restoreFailed': 'Could not restore.',
  'common.writeRejected': 'Rejected by the server – are the Firestore rules up to date?',
  'common.undo': 'Undo',
  'common.connecting': 'Connecting to server …',

  // --- Crew sign-in -----------------------------------------------------
  'crewGate.title': 'Who is aboard?',
  'crewGate.hint': 'Assign this device to a crew member to record position and log entries.',
  'crewGate.firstMemberHint':
    'This roadtrip has no crew yet. Add yourself as the first member – you will manage the crew afterwards.',
  'crewGate.firstMemberLabel': 'Your name',
  'crewGate.newHere': 'New here? Add yourself',
  'crewGate.namePlaceholder': 'Name',
  'crewGate.join': 'Join',
  'crewGate.nameTaken': '{name} is already aboard – pick the name above.',
  'crewGate.joinFailed': 'Could not join.',

  // --- Roadtrip gate ----------------------------------------------------
  'gate.joinHint': "Enter the roadtrip's name and the crew password to join.",
  'gate.createHint': 'Create a new roadtrip and set a password for the crew.',
  'gate.tabJoin': 'Join',
  'gate.tabCreate': 'Create roadtrip',
  'gate.namePlaceholder': 'Roadtrip name, e.g. Summer Tour 2026',
  'gate.passwordPlaceholder': 'Password',
  'gate.recoveryCodePlaceholder': 'Recovery code',
  'gate.passwordConfirmPlaceholder': 'Confirm password',
  'gate.submitting': 'One moment …',
  'gate.createSubmit': 'Create roadtrip',
  'gate.recoverySubmit': 'Sign in with code',
  'gate.joinSubmit': 'Join',
  'gate.usePassword': 'Use the normal password instead',
  'gate.useRecoveryCode': 'Forgot the password? Sign in with a recovery code',
  'gate.createFootnote':
    'After creating the roadtrip we show you a recovery code once – it gets you back in if the password is ever forgotten.',
  'gate.joinFootnote':
    'Share the password with your crew in person or by chat – it is the only way for others to join this roadtrip and see or change entries.',
  'gate.throttled': 'Too many failed attempts. Please wait {seconds} seconds.',
  'gate.passwordMismatch': 'The passwords do not match.',
  'gate.recoverySuccess': 'Signed in with recovery code',
  'gate.joinSuccess': 'Joined the roadtrip',

  // --- Sign-in errors (codes from lib/roadtrip.ts) ----------------------
  'authError.nameTaken':
    'That roadtrip name is already taken. Pick another name, or join the existing roadtrip.',
  'authError.wrongCredentials': 'Roadtrip name or password is incorrect.',
  'authError.tooManyAttempts': 'Too many attempts. Please wait a moment and try again.',
  'authError.unknown': 'Something went wrong. Please try again.',
  'authError.missingName': 'Please enter a name for the roadtrip.',
  'authError.passwordTooShort': 'The password must be at least {min} characters long.',

  // --- Recovery code ----------------------------------------------------
  'recovery.title': 'Recovery code for “{tripName}”',
  'recovery.description':
    'If the crew forgets the roadtrip password, this code is the only way back to your data. It is stored nowhere and never shown again – write it down somewhere safe now (a password manager or paper).',
  'recovery.copy': 'Copy',
  'recovery.copied': 'Copied',
  'recovery.acknowledge': 'I have stored the code somewhere safe.',

  // --- Cockpit ----------------------------------------------------------
  'cockpit.title': 'Cockpit',
  'cockpit.signedInAs': 'Signed in as {name}',
  'cockpit.gpsActive': 'GPS active',
  'cockpit.gpsSearching': 'Searching for satellites …',
  'cockpit.gpsUnsupported': 'Geolocation not supported',
  'cockpit.startTour': 'Start tour',
  'cockpit.stopTour': 'Stop tour',
  'cockpit.pauseTour': 'Pause',
  'cockpit.resumeTour': 'Resume',
  'cockpit.tourPaused': 'Paused',
  'cockpit.quickLogs': 'Quick logs',
  'cockpit.noQuickLogs': 'No quick logs configured',
  'cockpit.noQuickLogsHint': 'Add categories under More → Quick logs.',
  'cockpit.waitingForGps': 'Waiting for a GPS signal …',
  'cockpit.logged': '“{title}” logged',

  // --- Map --------------------------------------------------------------
  'map.currentPosition': 'Current position ({name})',
  'map.unfollow': 'Stop following position',
  'map.centerOnPosition': 'Center on my position',
  'map.orientNorth': 'Point the map north',
  'map.noPosition': 'No GPS position available yet.',
  'map.editEvent': 'Edit entry',
  'map.editButton': 'Edit',
  'map.invalidCoordinates': 'Invalid coordinates.',
  'map.latitude': 'Latitude',
  'map.longitude': 'Longitude',
  'map.eventUpdated': 'Entry updated',
  'map.eventTrashed': 'Entry moved to trash',
  'map.eventRestored': 'Entry restored',
  'map.deleteEventTitle': 'Delete entry',
  'map.deleteEventDescription':
    'The entry moves to the trash and can be restored under More → Trash.',

  // --- Logbook ----------------------------------------------------------
  'logbook.title': 'Logbook',
  'logbook.subtitle': 'Distance, duration and events of the trip',
  'logbook.distance': 'Distance',
  'logbook.duration': 'Duration',
  'logbook.events': 'Entries ({count})',
  'logbook.empty': 'No entries yet',
  'logbook.emptyHint': 'Record entries using the quick logs in the cockpit.',
  'logbook.titlePlaceholder': 'Title',
  'logbook.titleRequired': 'The title cannot be empty.',
  'logbook.eventUpdated': 'Entry updated',
  'logbook.eventTrashed': 'Entry moved to trash',
  'logbook.eventRestored': 'Entry restored',
  'logbook.deleteTitle': 'Delete entry',
  'logbook.deleteDescription':
    'The entry moves to the trash and can be restored under More → Trash.',
  'logbook.editEvent': 'Edit entry',
  'logbook.deleteEvent': 'Delete entry',

  'dayRecap.openButton': 'Create day recap image',
  'dayRecap.title': 'Day recap',
  'dayRecap.exportButton': 'Share',
  'dayRecap.noTrackHint': 'No route recorded for this day yet – the image will only show the stats.',
  'dayRecap.background': 'Background',
  'dayRecap.background.reduced': 'Reduced',
  'dayRecap.background.standard': 'Standard',
  'dayRecap.background.satellite': 'Satellite',

  // --- Trip kitty -------------------------------------------------------
  'costs.title': 'Trip kitty',
  'costs.subtitle': 'Record and keep track of the crew’s spending',
  'costs.total': 'Total spending',
  'costs.history': 'History',
  'costs.empty': 'No expenses yet',
  'costs.emptyHint': 'Add the trip’s first expense above.',
  'costs.descriptionPlaceholder': 'Description, e.g. diesel',
  'costs.descriptionShort': 'Description',
  'costs.amountPlaceholder': 'Amount in €',
  'costs.submit': 'Add',
  'costs.sharedPayer': 'Shared kitty',
  'costs.self': 'Me ({name})',
  'costs.descriptionRequired': 'The description cannot be empty.',
  'costs.invalidAmount': 'Invalid amount.',
  'costs.expenseUpdated': 'Expense updated',
  'costs.expenseTrashed': 'Expense moved to trash',
  'costs.expenseRestored': 'Expense restored',
  'costs.editExpense': 'Edit expense',
  'costs.deleteExpense': 'Delete expense',
  'costs.deleteTitle': 'Delete expense',
  'costs.deleteDescription': 'The entry moves to the trash and can be restored under More → Trash.',
  'costs.category.verpflegung': 'Food',
  'costs.category.tanken': 'Fuel',
  'costs.category.liegeplatz': 'Mooring',
  'costs.category.schleuse': 'Lock',
  'costs.category.sonstiges': 'Other',

  // --- Settlement (trip kitty) -------------------------------------------
  'settlement.title': 'Settlement',
  'settlement.nothingToSettle': 'So far everything was paid directly from the shared kitty – nothing to settle.',
  'settlement.nothingToSettleShort': 'Nothing to settle',
  'settlement.youGet': 'You get {amount}',
  'settlement.youOwe': 'You owe {amount}',
  'settlement.youAreEven': 'All even',
  'settlement.laidOutAndShare': '{paid} paid · {share} share',
  'settlement.allSettled': 'All balances are already settled.',
  'settlement.sharedNote': '{amount} was paid directly from the {payer} and is not included.',

  // --- Settings ---------------------------------------------------------
  'settings.title': 'Settings',
  'settings.subtitle': 'Device, display and data of this trip',
  'settings.thisRoadtrip': 'This roadtrip',
  'settings.roadtripProtected': 'Only reachable with the roadtrip password',
  'settings.thisDevice': 'This device',
  'settings.signedInProfile': 'Signed-in profile',
  'settings.liveSync': 'Live sync',
  'settings.offline': 'Offline',
  'settings.onlineNote': 'Changes are synced with the crew immediately.',
  'settings.offlineNote':
    'Changes are stored locally and synced as soon as there is a connection again.',
  'settings.display': 'Display',
  'settings.units': 'Units',
  'settings.unitsDescription': 'Speed and distance throughout the app',
  'settings.language': 'Language',
  'settings.languageDescription': 'Interface language on this device',
  'settings.map': 'Map',
  'settings.baseLayer': 'Base map',
  'settings.layerNote':
    'Layers stack up – the base map at the bottom, every active overlay above it.',
  'settings.recording': 'Recording',
  'settings.trackPoints': 'Track points',
  'settings.trackPointsDescription':
    'Less often saves battery and mobile data, more often records more precisely.',
  'settings.interval10s': 'Every 10 seconds',
  'settings.interval30s': 'Every 30 seconds',
  'settings.interval60s': 'Every minute',
  'settings.interval300s': 'Every 5 minutes',
  'settings.management': 'Management',
  'settings.data': 'Data',
  'settings.export': 'Export',
  'settings.exportValue': 'Report as PDF, CSV and GPX',
  'settings.trash': 'Trash',
  'settings.trashValue': 'Restore deleted items',
  'settings.legal': 'Legal',
  'settings.privacy': 'Privacy',
  'settings.privacyValue': 'GPS, names and costs',
  'settings.app': 'App',
  'settings.version': 'Version',
  'settings.logout': 'Sign out profile',
  'settings.leaveRoadtrip': 'Leave roadtrip',
  'settings.crewCount_one': '{count} member',
  'settings.crewCount_other': '{count} members',
  'settings.quickLogCount_one': '{count} category',
  'settings.quickLogCount_other': '{count} categories',

  // --- Crew management --------------------------------------------------
  'crew.title': 'Crew',
  'crew.subtitle': 'Who is aboard and can record entries',
  'crew.section': 'Crew ({count})',
  'crew.newNamePlaceholder': 'New name',
  'crew.addMember': 'Add crew member',
  'crew.removeMember': 'Remove {name}',
  'crew.self': '{name} (you)',
  'crew.alreadyAboard': '{name} is already aboard.',
  'crew.cannotRemoveSelf': 'You cannot remove yourself.',
  'crew.removed': '{name} removed',
  'crew.removeTitle': 'Remove crew member',
  'crew.removeDescription':
    '{name} will be removed from the crew list. Entries and expenses already recorded are kept.',
  'crew.role.owner': 'Owner',
  'crew.role.member': 'Crew member',
  'crew.role.readonly': 'Read-only',
  'crew.roleLabel': 'Role of {name}',
  'crew.roleUpdated': '{name} is now {role}.',
  'crew.onlyOwnerCanManage': 'Only owners can invite or remove crew members, or change roles.',
  'crew.lastOwnerRequired': 'At least one owner must remain.',
  'crew.readonlyHint': 'Read-only access: viewing works, changes do not.',

  // --- Quick logs -------------------------------------------------------
  'quickLogs.title': 'Quick logs',
  'quickLogs.subtitle': 'Categories for the event buttons in the cockpit',
  'quickLogs.newCategory': 'New category',
  'quickLogs.labelPlaceholder': 'Label, e.g. take on water',
  'quickLogs.addCategory': 'Add category',
  'quickLogs.addHint': 'Icon and label appear in the cockpit and in the logbook.',
  'quickLogs.categories': 'Categories ({count})',
  'quickLogs.empty': 'No quick logs',
  'quickLogs.emptyHint': 'Add the first category above.',
  'quickLogs.chooseIcon': 'Choose an icon',
  'quickLogs.iconLabel': 'Icon {name}',
  'quickLogs.edit': 'Edit {label}',
  'quickLogs.delete': 'Delete {label}',
  'quickLogs.saveEdit': 'Save change',
  'quickLogs.removed': 'Quick log removed',
  'quickLogs.removeTitle': 'Remove quick log',
  'quickLogs.removeDescription':
    '“{label}” will be removed from the quick logs. Entries already recorded are kept.',
  'quickLogs.default.schleuse': 'Lock',
  'quickLogs.default.pause': 'Break',
  'quickLogs.default.anlegen': 'Mooring',
  'quickLogs.default.grenze': 'Border',
  'quickLogs.default.panne': 'Breakdown',

  // --- Map layers -------------------------------------------------------
  'layer.osm': 'Standard',
  'layer.osm.description': 'OpenStreetMap – places, roads, waterways',
  'layer.topo': 'Topographic',
  'layer.topo.description': 'OpenTopoMap – contour lines and terrain',
  'layer.satellite': 'Satellite',
  'layer.satellite.description': 'Esri World Imagery – aerial imagery without labels',
  'layer.light': 'Muted',
  'layer.light.description': 'Light, low-contrast background – track and markers stand out',
  'layer.seamarks': 'Sea marks',
  'layer.seamarks.description': 'Buoys, lights and fairways (OpenSeaMap)',
  'layer.cycling': 'Cycle routes',
  'layer.cycling.description': 'Signposted long-distance cycle routes (Waymarked Trails)',
  'layer.hiking': 'Hiking trails',
  'layer.hiking.description': 'Marked hiking trails on land (Waymarked Trails)',
  'layer.showOnMap': 'Show {label} on the map',

  // --- Sync and updates -------------------------------------------------
  'sync.syncing': 'Syncing … ({count})',
  'sync.offlineQueued': 'Saved offline, will sync once there is a connection ({count})',
  'update.title': 'Update available',
  'update.description':
    'There is a new version of 2cars2georgia. A quick restart loads it – data you have already recorded is kept.',
  'update.confirm': 'Update now',
  'update.later': 'Later',
  'update.offlineReady': 'The app is ready for offline use.',

  // --- Privacy ----------------------------------------------------------
  'privacy.title': 'Privacy',
  'privacy.subtitle': 'What this app stores, and why',
  'privacy.intro':
    'This app is run privately among friends, not commercially. It still processes location, name and cost data of the crew – so here is a transparent account of what happens with what.',
  'privacy.controller': 'Controller',
  'privacy.controllerPlaceholder':
    '[Enter the name and contact details of the person running this roadtrip / the Firebase project – e.g. “First name Last name, email”.]',
  'privacy.dataTitle': 'What data is processed',
  'privacy.dataGps': 'Location (GPS):',
  'privacy.dataGpsText':
    'only while a tour is actively being recorded (“Start tour” in the cockpit) – coordinates, speed and heading, each with a timestamp and the name of the device/crew member.',
  'privacy.dataLog': 'Event logbook:',
  'privacy.dataLogText':
    'place, time, category (e.g. lock, break) and the name of whoever created the entry.',
  'privacy.dataCosts': 'Costs:',
  'privacy.dataCostsText': 'amounts, description, category and who paid or recorded them.',
  'privacy.dataNames': 'Crew names:',
  'privacy.dataNamesText':
    'self-chosen names of those aboard, no email addresses or other contact details.',
  'privacy.dataLocal': 'Technical, local to the device:',
  'privacy.dataLocalText':
    'the selected crew name (`localStorage`), the language setting and the roadtrip’s Firebase session – no advertising or tracking cookies.',
  'privacy.purposeTitle': 'Purpose and legal basis',
  'privacy.purposeText':
    'Processing serves solely the crew’s own organisation and documentation of this trip (Art. 6(1)(b) and (f) GDPR – performance of the jointly agreed use, and legitimate interest in planning the trip). For purely private use among close friends and family, the household exemption (Art. 2(2)(c) GDPR) may also apply. This assessment is not legal advice – for use beyond a close private circle, a lawyer should review it.',
  'privacy.processorsTitle': 'Who else sees the data',
  'privacy.processorsText':
    'The data is held by Google Firebase (Firestore database, authentication) as a technical processor; depending on the chosen Firestore region, servers may also be located outside the EU (e.g. in the USA). If Sentry is configured for error monitoring (see README), Sentry also receives technical error reports – deliberately without location, name or cost data, only the anonymous roadtrip ID as context.',
  'privacy.retentionTitle': 'Retention period',
  'privacy.retentionText':
    'Data remains stored for as long as the roadtrip exists in Firebase – there is currently no automatic deletion. On request, the controller (see above) deletes individual entries or the entire roadtrip manually.',
  'privacy.retentionTrashText':
    'Deleted logbook entries and expenses first go into the trash (More → Trash) and remain stored there so a mistake can be undone. They are only removed permanently once deleted there or the trash is emptied.',
  'privacy.exportTitle': 'Export and sharing',
  'privacy.exportText':
    'Under More → Export, the logbook, expenses and route can be taken out of the app as PDF, CSV or GPX. These files contain the crew’s names, positions and amounts and leave the app’s protected area once shared – sharing them with others should be agreed with everyone concerned.',
  'privacy.rightsTitle': 'Your rights',
  'privacy.rightsText':
    'You have the right to access, rectification, erasure and restriction of processing of your data, as well as to data portability and to object. Please contact the controller named above. You also have the right to lodge a complaint with a data protection supervisory authority.',
  'privacy.translationNote':
    'This is a translation for convenience. The German version of this privacy notice is the authoritative one.',

  // --- Export -------------------------------------------------------------
  'export.title': 'Export',
  'export.subtitle': 'Save or share the route, logbook and expenses',
  'export.reportSection': 'Trip report',
  'export.reportHint':
    'Opens the print dialog with the logbook, expenses and settlement. Choose “Save as PDF” there to keep or send the report.',
  'export.reportButton': 'Report as PDF',
  'export.rawDataSection': 'Raw data',
  'export.rawDataHint':
    'CSV opens in any spreadsheet app, GPX in map apps like OsmAnd, Komoot or Google Earth.',
  'export.eventsButton': 'Logbook as CSV ({count})',
  'export.expensesButton': 'Expenses as CSV ({count})',
  'export.trackButton': 'Route as GPX ({count} points)',
  'export.noteSection': 'Note',
  'export.noteText':
    'On a phone, the system’s share menu opens; on a computer, the file downloads. Exported files contain the crew’s names, positions and amounts – only share them if everyone agrees.',
  'export.failed': 'Export failed.',
  'export.saved': 'File saved',
  'export.shared': 'File shared',
  'export.defaultTripName': 'Roadtrip',

  // --- Trash --------------------------------------------------------------
  'trash.title': 'Trash',
  'trash.subtitle': 'Restore deleted entries and expenses',
  'trash.section': 'Deleted ({count})',
  'trash.empty': 'Trash is empty',
  'trash.emptyHint_one': 'Deleted entries land here and stay restorable for {count} day.',
  'trash.emptyHint_other': 'Deleted entries land here and stay restorable for {count} days.',
  'trash.restore': 'Restore “{title}”',
  'trash.restored': 'Entry restored',
  'trash.restoreFailed': 'Could not restore.',
  'trash.purgeOne': 'Delete “{title}” permanently',
  'trash.daysLeft_one': '{count} day left',
  'trash.daysLeft_other': '{count} days left',
  'trash.expired': 'Retention expired',
  'trash.cleanupSection': 'Clean up',
  'trash.expiredNote_one': '{count} entry has been in the trash for more than {days} days.',
  'trash.expiredNote_other': '{count} entries have been in the trash for more than {days} days.',
  'trash.retentionNote':
    'Entries stay restorable for {days} days. Deleting permanently cannot be undone.',
  'trash.emptyTrashButton': 'Empty trash',
  'trash.purgeAllTitle': 'Empty trash',
  'trash.purgeOneTitle': 'Delete permanently',
  'trash.purgeAllDescription_one': 'The {count} entry in the trash will be removed permanently.',
  'trash.purgeAllDescription_other': 'All {count} entries in the trash will be removed permanently.',
  'trash.purgeOneDescription': '“{title}” will be removed permanently.',
  'trash.purgedOne': 'Entry permanently deleted',
  'trash.purgedMany': '{count} entries permanently deleted',
  'trash.purgeFailed': 'Could not delete permanently.'
};
