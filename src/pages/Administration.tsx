import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import { useRoadtrip } from '../hooks/useRoadtrip';
import { ROLE_LABEL_KEY } from '../lib/permissions';
import { getUserColor } from '../lib/userColors';
import { useT } from '../i18n';
import { CrewRole } from '../types';
import { CrewMember } from '../hooks/useSettings';
import { EmptyState, ListItem, PageHeader, Section } from '../components/ui';
import './Settings.css';

interface AdminTrip {
  tripId: string;
  name: string;
  ownerUid: string;
  members: CrewMember[];
}

/**
 * Plattform-Administration: Übersicht aller Roadtrips mit ihren Mitgliedern.
 *
 * Nur für Profile mit `role: "admin"` in users/{uid} erreichbar – erzwungen
 * wird das serverseitig in firestore.rules (isPlatformAdmin), der Menüpunkt
 * in App.tsx blendet die Seite lediglich passend ein. Gelesen wird einmalig
 * beim Öffnen (getDocs statt onSnapshot): eine Übersicht über alle Roadtrips
 * braucht keine Live-Aktualisierung und soll keine dauerhaften Abos halten.
 */
export default function Administration() {
  const { isPlatformAdmin } = useRoadtrip();
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    if (!isPlatformAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tripsSnap = await getDocs(collection(db, 'roadtrips'));
        const loaded = await Promise.all(
          tripsSnap.docs.map(async (tripDoc) => {
            const membersSnap = await getDocs(collection(db, 'roadtrips', tripDoc.id, 'members'));
            return {
              tripId: tripDoc.id,
              name: (tripDoc.data().name as string | undefined) ?? tripDoc.id,
              ownerUid: (tripDoc.data().ownerUid as string | undefined) ?? '',
              members: membersSnap.docs.map((memberDoc) => ({
                uid: memberDoc.id,
                displayName: (memberDoc.data().displayName as string | undefined) ?? memberDoc.id,
                role: (memberDoc.data().role as CrewRole | undefined) ?? 'member'
              }))
            };
          })
        );
        if (cancelled) return;
        loaded.sort((a, b) => a.name.localeCompare(b.name));
        setTrips(loaded);
      } catch (err) {
        console.error('Firestore-Fehler (Administration):', err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin]);

  // Der Owner steht am Roadtrip nur als UID – den Namen liefert seine
  // Mitgliedschaft; fehlt sie, bleibt die UID als eindeutige Kennung stehen.
  const ownerLabel = (trip: AdminTrip) =>
    trip.members.find((m) => m.uid === trip.ownerUid)?.displayName ?? trip.ownerUid ?? '';

  return (
    <div className="settings-page">
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />

      {!isPlatformAdmin ? (
        <EmptyState icon={<ShieldCheck size={22} />} title={t('admin.noAccess')} />
      ) : loading ? (
        <p className="helper-text">{t('common.connecting')}</p>
      ) : failed ? (
        <p className="helper-text">{t('admin.loadError')}</p>
      ) : trips.length === 0 ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <Section title={t('admin.tripsSection', { count: trips.length })}>
          <div className="settings-list">
            {trips.map((trip) => {
              const open = openTripId === trip.tripId;
              return (
                <div key={trip.tripId}>
                  <button
                    type="button"
                    className="admin-trip-row"
                    aria-expanded={open}
                    onClick={() => setOpenTripId(open ? null : trip.tripId)}
                  >
                    <ListItem
                      title={trip.name}
                      subtitle={
                        <>
                          <code>{trip.tripId}</code>
                          {' · '}
                          {t('admin.owner', { name: ownerLabel(trip) })}
                          {' · '}
                          {t('admin.memberCount', { count: trip.members.length })}
                        </>
                      }
                      trailing={open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    />
                  </button>
                  {open && (
                    <div className="settings-list admin-member-list">
                      {trip.members.map((member) => (
                        <ListItem
                          key={member.uid}
                          leading={
                            <span
                              className="avatar"
                              style={{ background: getUserColor(member.displayName), color: '#ffffff' }}
                            >
                              {member.displayName.charAt(0).toUpperCase()}
                            </span>
                          }
                          title={member.displayName}
                          subtitle={t(ROLE_LABEL_KEY[member.role])}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
