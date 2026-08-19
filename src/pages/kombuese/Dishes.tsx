import { useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { db } from '../../firebase';
import { useCollection } from '../../hooks/useCollection';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { usePermissions } from '../../hooks/usePermissions';
import { useSoftDelete } from '../../hooks/useSoftDelete';
import { trackWrite } from '../../lib/pendingWrites';
import { activeOnly } from '../../lib/trash';
import { useT } from '../../i18n';
import { Dish, Ingredient, MealType } from '../../types';
import {
  Button,
  Input,
  Section,
  ListItem,
  EmptyState,
  IconButton,
  PageHeader,
  SegmentedControl,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';
import './Kombuese.css';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

interface IngredientDraft {
  name: string;
  quantity: string;
  unit: string;
}

const emptyIngredientDraft = (): IngredientDraft => ({ name: '', quantity: '', unit: '' });

/** Zeilen ohne Namen fallen beim Speichern raus, Menge fällt auf 0 zurück
 * statt das Speichern zu blockieren – ein Draft mit unvollständiger letzter
 * Zeile ist der Normalfall beim Tippen, kein Fehler. */
function toIngredients(drafts: IngredientDraft[]): Ingredient[] {
  return drafts
    .filter((d) => d.name.trim())
    .map((d) => ({
      name: d.name.trim(),
      quantity: Math.max(0, parseFloat(d.quantity.replace(',', '.')) || 0),
      unit: d.unit.trim()
    }));
}

function fromIngredients(ingredients: Ingredient[]): IngredientDraft[] {
  return ingredients.map((i) => ({ name: i.name, quantity: String(i.quantity), unit: i.unit }));
}

interface DishFormProps {
  initial?: Dish;
  onCancel: () => void;
  onSave: (values: { name: string; mealType: MealType; ingredients: Ingredient[]; note: string }) => Promise<boolean>;
}

function DishForm({ initial, onCancel, onSave }: DishFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [mealType, setMealType] = useState<MealType>(initial?.mealType ?? 'dinner');
  const [note, setNote] = useState(initial?.note ?? '');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    initial ? fromIngredients(initial.ingredients) : [emptyIngredientDraft()]
  );
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  const t = useT();

  const updateIngredient = (index: number, patch: Partial<IngredientDraft>) => {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeIngredient = (index: number) => {
    setIngredients((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      notify(t('dishes.nameRequired'), 'danger');
      return;
    }
    setSaving(true);
    const saved = await onSave({
      name: trimmedName,
      mealType,
      ingredients: toIngredients(ingredients),
      note: note.trim()
    });
    setSaving(false);
    if (saved) onCancel();
  };

  return (
    <Section title={initial ? t('dishes.editDish') : t('dishes.addDish')}>
      <form onSubmit={handleSubmit} className="stack">
        <Input
          autoFocus
          placeholder={t('dishes.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <SegmentedControl
          label={t('dishes.title')}
          value={mealType}
          onChange={setMealType}
          options={MEAL_TYPES.map((value) => ({ value, label: t(`mealType.${value}`) }))}
        />

        <div className="kombuese-ingredient-list">
          <span className="label">{t('dishes.ingredients')}</span>
          {ingredients.map((ingredient, index) => (
            <div key={index} className="row kombuese-ingredient-row">
              <Input
                placeholder={t('dishes.ingredientNamePlaceholder')}
                value={ingredient.name}
                onChange={(e) => updateIngredient(index, { name: e.target.value })}
                className="kombuese-ingredient-name"
              />
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder={t('dishes.ingredientQuantityPlaceholder')}
                value={ingredient.quantity}
                onChange={(e) => updateIngredient(index, { quantity: e.target.value })}
                className="kombuese-ingredient-quantity"
              />
              <Input
                placeholder={t('dishes.ingredientUnitPlaceholder')}
                value={ingredient.unit}
                onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                className="kombuese-ingredient-unit"
              />
              <IconButton
                label={t('dishes.removeIngredient')}
                tone="danger"
                onClick={() => removeIngredient(index)}
              >
                <X size={16} />
              </IconButton>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIngredients((rows) => [...rows, emptyIngredientDraft()])}
          >
            <Plus size={16} /> {t('dishes.addIngredient')}
          </Button>
        </div>

        <Input
          placeholder={t('dishes.notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="row">
          <Button type="submit" fullWidth disabled={saving}>
            {t('common.save')}
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

export default function Dishes({ currentUser }: { currentUser: string }) {
  const { tripId } = useRoadtrip();
  const { canEdit } = usePermissions(currentUser);
  const allDishes = useCollection<Dish>(tripId ? tripPath(tripId, 'dishes') : null, 'timestamp', 'desc');
  const [filter, setFilter] = useState<MealType | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const { notify } = useToast();
  const t = useT();
  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    'dishes',
    'dishes.trashed',
    'dishes.restored'
  );

  const dishes = useMemo(() => activeOnly(allDishes), [allDishes]);
  const visibleDishes = useMemo(
    () => (filter === 'all' ? dishes : dishes.filter((d) => d.mealType === filter)),
    [dishes, filter]
  );

  const handleSave = async (values: {
    name: string;
    mealType: MealType;
    ingredients: Ingredient[];
    note: string;
  }): Promise<boolean> => {
    if (!tripId) return false;
    try {
      if (editingDish) {
        await trackWrite(
          updateDoc(doc(db, tripPath(tripId, 'dishes'), editingDish.id!), {
            name: values.name,
            mealType: values.mealType,
            ingredients: values.ingredients,
            ...(values.note ? { note: values.note } : {})
          })
        );
      } else {
        const newDish: Dish = {
          name: values.name,
          mealType: values.mealType,
          ingredients: values.ingredients,
          author: currentUser,
          timestamp: Date.now(),
          ...(values.note ? { note: values.note } : {})
        };
        await trackWrite(addDoc(collection(db, tripPath(tripId, 'dishes')), newDish));
      }
      notify(t('dishes.saved'), 'success');
      return true;
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
      return false;
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingDish(null);
  };

  return (
    <div className="settings-page">
      <PageHeader
        title={t('dishes.title')}
        subtitle={t('dishes.subtitle')}
        backTo="/settings"
        backLabel={t('settings.title')}
      />

      {canEdit && !formOpen && (
        <Button fullWidth onClick={() => setFormOpen(true)}>
          <Plus size={18} /> {t('dishes.addDish')}
        </Button>
      )}

      {canEdit && formOpen && (
        <DishForm initial={editingDish ?? undefined} onCancel={closeForm} onSave={handleSave} />
      )}

      <div className="section-title-spaced">
        <SegmentedControl
          label={t('dishes.title')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all' as const, label: t('mealType.all') },
            ...MEAL_TYPES.map((value) => ({ value, label: t(`mealType.${value}`) }))
          ]}
        />
      </div>

      {visibleDishes.length === 0 ? (
        <EmptyState title={t('dishes.empty')} hint={t('dishes.emptyHint')} />
      ) : (
        <div className="settings-list">
          {visibleDishes.map((dish) => (
            <ListItem
              key={dish.id}
              title={dish.name}
              subtitle={`${t(`mealType.${dish.mealType}`)} · ${
                dish.ingredients.length === 0
                  ? t('dishes.noIngredients')
                  : t('dishes.ingredientCount', { count: dish.ingredients.length })
              }`}
              trailing={
                canEdit ? (
                  <>
                    <IconButton
                      label={t('dishes.editDish')}
                      onClick={() => {
                        setEditingDish(dish);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label={t('dishes.deleteDish')}
                      tone="danger"
                      onClick={() => requestDelete(dish.id!)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('dishes.deleteTitle')}
        description={t('dishes.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
