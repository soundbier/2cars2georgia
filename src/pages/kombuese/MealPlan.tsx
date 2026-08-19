import { FormEvent, useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { CalendarDays, ShieldCheck, X } from 'lucide-react';
import { db } from '../../firebase';
import { useCollection } from '../../hooks/useCollection';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { usePermissions } from '../../hooks/usePermissions';
import { useSoftDelete } from '../../hooks/useSoftDelete';
import { useTripDates } from '../../hooks/useSettings';
import { trackWrite } from '../../lib/pendingWrites';
import { activeOnly } from '../../lib/trash';
import { useI18n, useT } from '../../i18n';
import { Dish, MealPlanEntry, MealType } from '../../types';
import {
  Button,
  Input,
  Select,
  Section,
  EmptyState,
  IconButton,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';
import './Kombuese.css';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

/** Alle Kalendertage von start bis end (inklusive), als 'YYYY-MM-DD'. In UTC
 * gerechnet, damit die Zeitzone des Geräts keinen Tag verschluckt oder
 * doppelt zählt. */
function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Admin-gated Formular zum (Nach-)Tragen des Reisezeitraums. Nur sichtbar,
 * wenn die Sitzung tatsächlich Adminrechte hat – ohne das lehnt der Server
 * das Update ohnehin ab (settings/general ist außerhalb des Beitritts- und
 * Schnell-Log-Pfads adminpflichtig, siehe firestore.rules). */
function TripDatesForm() {
  const { tripId } = useRoadtrip();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tripId || !startDate || !endDate || endDate < startDate) return;
    setSaving(true);
    try {
      await trackWrite(
        updateDoc(doc(db, tripPath(tripId, 'settings', 'general')), { startDate, endDate })
      );
      notify(t('mealPlan.tripDatesSaved'), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={t('mealPlan.setTripDates')}>
      <form onSubmit={handleSubmit} className="stack">
        <div className="row">
          <Input
            type="date"
            aria-label={t('trip.startDatePlaceholder')}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            type="date"
            aria-label={t('trip.endDatePlaceholder')}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
            required
          />
        </div>
        <Button type="submit" disabled={saving}>
          {t('common.save')}
        </Button>
      </form>
    </Section>
  );
}

interface MealGroupProps {
  date: string;
  mealType: MealType;
  entries: MealPlanEntry[];
  dishById: Map<string, Dish>;
  dishesForMealType: Dish[];
  canEdit: boolean;
  onAssign: (date: string, mealType: MealType, dishId: string) => void;
  onRemove: (entryId: string) => void;
}

function MealGroup({
  date,
  mealType,
  entries,
  dishById,
  dishesForMealType,
  canEdit,
  onAssign,
  onRemove
}: MealGroupProps) {
  const [selected, setSelected] = useState('');
  const t = useT();

  return (
    <div className="kombuese-meal-group">
      <span className="label kombuese-meal-group-label">{t(`mealType.${mealType}`)}</span>
      {entries.map((entry) => {
        const dish = dishById.get(entry.dishId);
        return (
          <div key={entry.id} className="row">
            <span className="list-item-title">{dish?.name ?? entry.dishId}</span>
            {canEdit && (
              <IconButton label={t('mealPlan.removeEntry')} tone="danger" onClick={() => onRemove(entry.id!)}>
                <X size={16} />
              </IconButton>
            )}
          </div>
        );
      })}
      {canEdit &&
        (dishesForMealType.length === 0 ? (
          <p className="helper-text">{t('mealPlan.noDishesForMealType')}</p>
        ) : (
          <Select
            value={selected}
            aria-label={t('mealPlan.addEntry')}
            onChange={(e) => {
              const dishId = e.target.value;
              if (!dishId) return;
              onAssign(date, mealType, dishId);
              setSelected('');
            }}
          >
            <option value="">{t('mealPlan.choosePlaceholder')}</option>
            {dishesForMealType.map((dish) => (
              <option key={dish.id} value={dish.id}>
                {dish.name}
              </option>
            ))}
          </Select>
        ))}
    </div>
  );
}

export default function MealPlan({ currentUser }: { currentUser: string }) {
  const { tripId, isAdmin } = useRoadtrip();
  const { canEdit } = usePermissions(currentUser);
  const { startDate, endDate, loading: datesLoading } = useTripDates();
  const { locale } = useI18n();
  const t = useT();
  const { notify } = useToast();

  const allDishes = useCollection<Dish>(tripId ? tripPath(tripId, 'dishes') : null, 'timestamp', 'desc');
  const allEntries = useCollection<MealPlanEntry>(
    tripId ? tripPath(tripId, 'mealPlanEntries') : null,
    'timestamp',
    'asc'
  );
  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    'mealPlanEntries',
    'mealPlan.trashed',
    'mealPlan.restored'
  );

  const dishes = useMemo(() => activeOnly(allDishes), [allDishes]);
  const dishById = useMemo(() => new Map(dishes.map((d) => [d.id!, d])), [dishes]);
  const dishesByMealType = useMemo(() => {
    const map = new Map<MealType, Dish[]>();
    for (const mealType of MEAL_TYPES) map.set(mealType, dishes.filter((d) => d.mealType === mealType));
    return map;
  }, [dishes]);

  const entries = useMemo(() => activeOnly(allEntries), [allEntries]);
  const entriesByDayAndMeal = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>();
    for (const entry of entries) {
      const key = `${entry.date}|${entry.mealType}`;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const days = useMemo(() => (startDate && endDate ? dateRange(startDate, endDate) : []), [startDate, endDate]);

  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: '2-digit' }),
    [locale]
  );

  const handleAssign = async (date: string, mealType: MealType, dishId: string) => {
    if (!tripId || !canEdit) return;
    const newEntry: MealPlanEntry = { date, mealType, dishId, author: currentUser, timestamp: Date.now() };
    try {
      await trackWrite(addDoc(collection(db, tripPath(tripId, 'mealPlanEntries')), newEntry));
      notify(t('mealPlan.entryAdded'), 'success');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    }
  };

  return (
    <div className="settings-page">
      <PageHeader
        title={t('mealPlan.title')}
        subtitle={t('mealPlan.subtitle')}
        backTo="/settings"
        backLabel={t('settings.title')}
      />

      {!datesLoading && (!startDate || !endDate) ? (
        <>
          <EmptyState
            icon={<CalendarDays size={26} strokeWidth={1.5} />}
            title={t('mealPlan.noTripDates')}
            hint={isAdmin ? undefined : t('mealPlan.noTripDatesHint')}
          />
          {!isAdmin && (
            <p className="helper-text setting-note">
              <ShieldCheck size={13} className="setting-note-icon" />
              {t('mealPlan.noTripDatesHint')}
            </p>
          )}
          {isAdmin && <TripDatesForm />}
        </>
      ) : (
        days.map((date) => (
          <div key={date} className="kombuese-day">
            <span className="kombuese-day-title">{dayFormatter.format(new Date(`${date}T00:00:00Z`))}</span>
            {MEAL_TYPES.map((mealType) => (
              <MealGroup
                key={mealType}
                date={date}
                mealType={mealType}
                entries={entriesByDayAndMeal.get(`${date}|${mealType}`) ?? []}
                dishById={dishById}
                dishesForMealType={dishesByMealType.get(mealType) ?? []}
                canEdit={canEdit}
                onAssign={handleAssign}
                onRemove={requestDelete}
              />
            ))}
          </div>
        ))
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('mealPlan.deleteTitle')}
        description={t('mealPlan.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
