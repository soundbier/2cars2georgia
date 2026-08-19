import { useMemo, useState } from 'react';
import { collection, addDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Check, Square } from 'lucide-react';
import { db } from '../../firebase';
import { useCollection } from '../../hooks/useCollection';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { usePermissions } from '../../hooks/usePermissions';
import { useSoftDelete } from '../../hooks/useSoftDelete';
import { trackWrite } from '../../lib/pendingWrites';
import { writeOptimistically } from '../../lib/writeOutcome';
import { activeOnly } from '../../lib/trash';
import { computeShoppingList } from '../../lib/shoppingList';
import { useT } from '../../i18n';
import { Dish, InventoryItem, MealPlanEntry, ShoppingListCheck, ShoppingListExtra } from '../../types';
import {
  Input,
  Section,
  ListItem,
  IconButton,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';
import './Kombuese.css';

export default function ShoppingList({ currentUser }: { currentUser: string }) {
  const { tripId } = useRoadtrip();
  const { canEdit } = usePermissions(currentUser);
  const t = useT();
  const { notify } = useToast();

  const dishes = useCollection<Dish>(tripId ? tripPath(tripId, 'dishes') : null, 'timestamp', 'desc');
  const mealPlan = useCollection<MealPlanEntry>(
    tripId ? tripPath(tripId, 'mealPlanEntries') : null,
    'timestamp',
    'asc'
  );
  const inventory = useCollection<InventoryItem>(tripId ? tripPath(tripId, 'inventory') : null, 'timestamp', 'asc');
  const allExtras = useCollection<ShoppingListExtra>(
    tripId ? tripPath(tripId, 'shoppingListExtras') : null,
    'timestamp',
    'asc'
  );
  const checks = useCollection<ShoppingListCheck & { id: string }>(
    tripId ? tripPath(tripId, 'shoppingListChecks') : null,
    'checkedAt',
    'asc'
  );
  const checkByKey = useMemo(() => new Map(checks.map((c) => [c.id, c.checked])), [checks]);

  const lines = useMemo(() => computeShoppingList(mealPlan, dishes, inventory), [mealPlan, dishes, inventory]);
  const extras = useMemo(() => activeOnly(allExtras), [allExtras]);

  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    'shoppingListExtras',
    'shoppingList.trashed',
    'shoppingList.restored'
  );

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');

  const toggleComputedCheck = (key: string) => {
    if (!tripId || !canEdit) return;
    const next = !(checkByKey.get(key) ?? false);
    writeOptimistically(
      setDoc(
        doc(db, tripPath(tripId, 'shoppingListChecks'), key),
        { checked: next, checkedBy: currentUser, checkedAt: Date.now() },
        { merge: true }
      ),
      () => notify(t('common.saveError'), 'danger')
    );
  };

  const toggleExtraCheck = (extra: ShoppingListExtra) => {
    if (!tripId || !canEdit) return;
    writeOptimistically(
      updateDoc(doc(db, tripPath(tripId, 'shoppingListExtras'), extra.id!), { checked: !extra.checked }),
      () => notify(t('common.saveError'), 'danger')
    );
  };

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !canEdit) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const parsedQuantity = Math.max(0, parseFloat(quantity.replace(',', '.')) || 0);

    const newExtra: ShoppingListExtra = {
      name: trimmedName,
      quantity: parsedQuantity,
      unit: unit.trim(),
      checked: false,
      author: currentUser,
      timestamp: Date.now()
    };

    try {
      await trackWrite(addDoc(collection(db, tripPath(tripId, 'shoppingListExtras')), newExtra));
      setName('');
      setQuantity('');
      setUnit('');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    }
  };

  return (
    <div className="settings-page">
      <PageHeader
        title={t('shoppingList.title')}
        subtitle={t('shoppingList.subtitle')}
        backTo="/settings"
        backLabel={t('settings.title')}
      />

      <h2 className="section-title section-title-spaced">{t('shoppingList.fromMealPlan')}</h2>
      {lines.length === 0 ? (
        <p className="helper-text">{t('shoppingList.fromMealPlanEmpty')}</p>
      ) : (
        <div className="settings-list">
          {lines.map((line) => {
            const checked = checkByKey.get(line.key) ?? false;
            return (
              <ListItem
                key={line.key}
                leading={
                  canEdit ? (
                    <IconButton
                      label={t(checked ? 'shoppingList.uncheck' : 'shoppingList.check', { name: line.name })}
                      tone={checked ? 'accent' : 'default'}
                      onClick={() => toggleComputedCheck(line.key)}
                    >
                      {checked ? <Check size={18} /> : <Square size={18} />}
                    </IconButton>
                  ) : undefined
                }
                title={
                  <span className={checked ? 'kombuese-shopping-item-checked' : undefined}>{line.name}</span>
                }
                trailing={
                  <span className="mono-num">
                    {line.neededQuantity} {line.unit}
                  </span>
                }
              />
            );
          })}
        </div>
      )}

      <h2 className="section-title section-title-spaced">{t('shoppingList.manual')}</h2>
      {extras.length === 0 ? (
        <p className="helper-text">{t('shoppingList.manualEmpty')}</p>
      ) : (
        <div className="settings-list">
          {extras.map((extra) => (
            <ListItem
              key={extra.id}
              leading={
                canEdit ? (
                  <IconButton
                    label={t(extra.checked ? 'shoppingList.uncheck' : 'shoppingList.check', { name: extra.name })}
                    tone={extra.checked ? 'accent' : 'default'}
                    onClick={() => toggleExtraCheck(extra)}
                  >
                    {extra.checked ? <Check size={18} /> : <Square size={18} />}
                  </IconButton>
                ) : undefined
              }
              title={
                <span className={extra.checked ? 'kombuese-shopping-item-checked' : undefined}>
                  {extra.name}
                </span>
              }
              trailing={
                <>
                  <span className="mono-num">
                    {extra.quantity} {extra.unit}
                  </span>
                  {canEdit && (
                    <IconButton
                      label={t('shoppingList.deleteExtra')}
                      tone="danger"
                      onClick={() => requestDelete(extra.id!)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}

      {canEdit && (
        <Section title={t('shoppingList.addExtra')}>
          <form onSubmit={handleAddExtra} className="row">
            <Input
              placeholder={t('shoppingList.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder={t('shoppingList.quantityPlaceholder')}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Input
              placeholder={t('shoppingList.unitPlaceholder')}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <IconButton type="submit" label={t('shoppingList.addExtra')} tone="accent">
              <Plus size={20} />
            </IconButton>
          </form>
        </Section>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('shoppingList.deleteTitle')}
        description={t('shoppingList.deleteDescription', {
          name: extras.find((e) => e.id === deleteTargetId)?.name ?? ''
        })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
