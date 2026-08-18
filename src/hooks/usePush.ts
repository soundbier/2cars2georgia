import { useCallback, useEffect, useState } from 'react';
import { onMessage } from 'firebase/messaging';
import { useRoadtrip } from './useRoadtrip';
import { useToast } from '../components/ui';
import {
  currentPermission,
  disablePush,
  enablePush,
  isPushConfigured,
  isPushSupported,
  readRegistration,
  savePushTopics,
  PermissionState
} from '../lib/push';
import { DEFAULT_PUSH_TOPICS, PushTopic, PushTopics, hasNoTopics } from '../lib/pushTopics';

export interface PushState {
  /** null solange noch geprüft wird, ob dieses Gerät Push überhaupt kann. */
  supported: boolean | null;
  configured: boolean;
  permission: PermissionState;
  /** true, wenn dieses Gerät als Empfänger eingetragen ist. */
  enabled: boolean;
  topics: PushTopics;
  busy: boolean;
}

/**
 * Zustand der Push-Registrierung dieses Geräts für die Einstellungsseite.
 *
 * „Aktiviert“ heißt: Es gibt ein Gerätedokument in Firestore UND der Browser
 * hat die Berechtigung erteilt. Beides kann unabhängig voneinander wegfallen –
 * die Berechtigung wird in den Systemeinstellungen entzogen, das Dokument beim
 * Abmelden gelöscht –, deshalb wird beides getrennt geführt.
 */
export function usePush(user: string) {
  const { tripId } = useRoadtrip();
  const { notify } = useToast();
  const [state, setState] = useState<PushState>({
    supported: null,
    configured: isPushConfigured(),
    permission: currentPermission(),
    enabled: false,
    topics: DEFAULT_PUSH_TOPICS,
    busy: false
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supported = await isPushSupported();
      const registration = supported && tripId ? await readRegistration(tripId) : null;
      if (cancelled) return;

      setState((prev) => ({
        ...prev,
        supported,
        permission: currentPermission(),
        // Ein Gerätedokument ohne erteilte Berechtigung ist eine Leiche aus
        // einer früheren Sitzung und zählt nicht als aktiv.
        enabled: registration !== null && currentPermission() === 'granted',
        topics: registration?.topics ?? DEFAULT_PUSH_TOPICS
      }));
    })().catch((err) => console.error('Push-Status konnte nicht geladen werden:', err));

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const enable = useCallback(async () => {
    if (!tripId) return;
    setState((prev) => ({ ...prev, busy: true }));
    try {
      const token = await enablePush(tripId, user, state.topics);
      const permission = currentPermission();
      setState((prev) => ({ ...prev, busy: false, permission, enabled: token !== null }));

      if (token) {
        notify('Benachrichtigungen aktiviert', 'success');
      } else if (permission === 'denied') {
        notify('Benachrichtigungen wurden im Browser blockiert.', 'danger');
      } else {
        notify('Benachrichtigungen konnten nicht aktiviert werden.', 'danger');
      }
    } catch (err) {
      console.error(err);
      setState((prev) => ({ ...prev, busy: false }));
      notify('Benachrichtigungen konnten nicht aktiviert werden.', 'danger');
    }
  }, [tripId, user, state.topics, notify]);

  const disable = useCallback(async () => {
    if (!tripId) return;
    setState((prev) => ({ ...prev, busy: true }));
    try {
      await disablePush(tripId);
      setState((prev) => ({ ...prev, busy: false, enabled: false }));
      notify('Benachrichtigungen deaktiviert', 'success');
    } catch (err) {
      console.error(err);
      setState((prev) => ({ ...prev, busy: false }));
      notify('Abmelden fehlgeschlagen.', 'danger');
    }
  }, [tripId, notify]);

  const setTopic = useCallback(
    async (topic: PushTopic, value: boolean) => {
      const topics = { ...state.topics, [topic]: value };
      setState((prev) => ({ ...prev, topics }));

      if (!tripId || !state.enabled) return;

      try {
        await savePushTopics(tripId, topics);
        // Kein einziges Thema mehr: Die Registrierung ist damit funktionslos,
        // aber das Gerät bleibt angemeldet – sonst müsste die Crew beim
        // nächsten Einschalten erneut durch die Berechtigungsabfrage.
        if (hasNoTopics(topics)) notify('Keine Themen ausgewählt – es kommt nichts an.', 'info');
      } catch (err) {
        console.error(err);
        setState((prev) => ({ ...prev, topics: state.topics }));
        notify('Änderung konnte nicht gespeichert werden.', 'danger');
      }
    },
    [tripId, state.topics, state.enabled, notify]
  );

  return { ...state, enable, disable, setTopic };
}

/**
 * Zeigt Meldungen, die eintreffen während die App im Vordergrund läuft.
 *
 * FCM unterdrückt in diesem Fall die System-Benachrichtigung – ohne diesen
 * Handler bliebe eine Meldung, die genau beim Blick auf die App ankommt,
 * komplett unsichtbar.
 */
export function usePushForegroundMessages() {
  const { notify } = useToast();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    (async () => {
      if (!(await isPushSupported())) return;
      const { getMessaging } = await import('firebase/messaging');
      const { app } = await import('../firebase');
      unsubscribe = onMessage(getMessaging(app), (payload) => {
        const { title, body } = payload.notification ?? {};
        if (!title) return;
        notify(body ? `${title} – ${body}` : title, 'info');
      });
    })().catch((err) => console.error('Vordergrund-Meldungen nicht verfügbar:', err));

    return () => unsubscribe?.();
  }, [notify]);
}
