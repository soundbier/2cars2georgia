/**
 * Themen, die ein Gerät einzeln an- und abschalten kann. Spiegelt bewusst
 * functions/src/notifications.ts – beide Seiten müssen sich über die Namen
 * einig sein, teilen aber keinen Build.
 */
export type PushTopic = 'expenses' | 'events' | 'emergency';

export type PushTopics = Record<PushTopic, boolean>;

export const PUSH_TOPIC_IDS: PushTopic[] = ['expenses', 'events', 'emergency'];

export const PUSH_TOPIC_META: Record<PushTopic, { label: string; description: string }> = {
  expenses: {
    label: 'Neue Ausgaben',
    description: 'Wenn ein Crewmitglied etwas in die Reisekasse einträgt.'
  },
  events: {
    label: 'Neue Logbuch-Einträge',
    description: 'Schleuse, Anlegen, Panne – sobald jemand ein Ereignis protokolliert.'
  },
  emergency: {
    label: 'Position steht still',
    description:
      'Wenn eine laufende Aufzeichnung 20 Minuten lang keine neue Position mehr liefert.'
  }
};

/**
 * Voreinstellung beim ersten Aktivieren: Der Notfall-Fall ist der eigentliche
 * Grund für Push und deshalb an. Jeder einzelne Logbuch-Eintrag dagegen wäre
 * auf einer Tour mit vielen Schleusen schnell nur noch Lärm – bewusst aus.
 */
export const DEFAULT_PUSH_TOPICS: PushTopics = {
  expenses: true,
  events: false,
  emergency: true
};

/** true, wenn kein einziges Thema mehr abonniert ist. */
export function hasNoTopics(topics: PushTopics): boolean {
  return PUSH_TOPIC_IDS.every((id) => !topics[id]);
}

/**
 * Ergänzt fehlende Themen mit der Voreinstellung. Ein Gerät, das sich vor der
 * Einführung eines Themas registriert hat, bekommt sonst für dieses Thema
 * `undefined` und würde stumm bleiben, ohne dass es im UI auffällt.
 */
export function withDefaults(stored: Partial<PushTopics> | undefined): PushTopics {
  return { ...DEFAULT_PUSH_TOPICS, ...stored };
}
