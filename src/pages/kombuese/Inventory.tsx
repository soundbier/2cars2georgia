import { useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Minus, Trash2, Package } from 'lucide-react';
import { db } from '../../firebase';
import { useCollection } from '../../hooks/useCollection';
import { useRoadtrip, tripPath } from '../../hooks/useRoadtrip';
import { usePermissions } from '../../hooks/usePermissions';
import { useSoftDelete } from '../../hooks/useSoftDelete';
import { trackWrite } from '../../lib/pendingWrites';
import { writeOptimistically } from '../../lib/writeOutcome';
import { activeOnly } from '../../lib/trash';
import { useT } from '../../i18n';
import { InventoryItem } from '../../types';
import {
  Button,
  Input,
  Section,
  ListItem,
  EmptyState,
  IconButton,
  PageHeader,
  ConfirmDialog,
  useToast
} from '../../components/ui';
import '../Settings.css';
import './Kombuese.css';

/** Schrittweite für +/- – Zehntel, damit auch Gewichtsangaben in kg
 * (0,5 kg Reis übrig) sich sinnvoll anpassen lassen, nicht nur Stückzahlen. */
const STEP = 0.5;

export default function Inventory({ currentUser }: { currentUser: string }) {
  const { tripId } = useRoadtrip();
  const { canEdit } = usePermissions(currentUser);
  const allItems = useCollection<InventoryItem>(
    tripId ? tripPath(tripId, 'inventory') : null,
    'timestamp',
    'asc'
  );
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [location, setLocation] = useState('');
  const { notify } = useToast();
  const t = useT();
  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    'inventory',
    'inventory.trashed',
    'inventory.restored'
  );

  const items = useMemo(() => activeOnly(allItems), [allItems]);
  const groups = useMemo(() => {
    const byLocation = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const list = byLocation.get(item.location) ?? [];
      list.push(item);
      byLocation.set(item.location, list);
    }
    return [...byLocation.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !canEdit) return;
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    if (!trimmedName || !trimmedLocation) return;
    const parsedQuantity = Math.max(0, parseFloat(quantity.replace(',', '.')) || 0);

    const newItem: InventoryItem = {
      name: trimmedName,
      quantity: parsedQuantity,
      unit: unit.trim(),
      location: trimmedLocation,
      author: currentUser,
      timestamp: Date.now()
    };

    try {
      await trackWrite(addDoc(collection(db, tripPath(tripId, 'inventory')), newItem));
      notify(t('inventory.saved'), 'success');
      setName('');
      setQuantity('');
      setUnit('');
      setLocation('');
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
    }
  };

  // Der Stepper schreibt direkt, ohne Zwischenformular – "einfach
  // veränderbar" ist der Punkt: Wer beim Kochen die letzten 200g Reis
  // verbraucht, soll das in einem Tipp eintragen können.
  const adjustQuantity = (item: InventoryItem, delta: number) => {
    if (!tripId || !canEdit) return;
    const next = Math.max(0, Math.round((item.quantity + delta) * 100) / 100);
    writeOptimistically(
      updateDoc(doc(db, tripPath(tripId, 'inventory'), item.id!), { quantity: next }),
      () => notify(t('common.saveError'), 'danger')
    );
  };

  return (
    <div className="settings-page">
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        backTo="/settings"
        backLabel={t('settings.title')}
      />

      {canEdit && (
        <Section title={t('inventory.addItem')}>
          <form onSubmit={handleAdd} className="stack">
            <Input
              placeholder={t('inventory.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="row">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder={t('inventory.quantityPlaceholder')}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Input
                placeholder={t('inventory.unitPlaceholder')}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <Input
              placeholder={t('inventory.locationPlaceholder')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
            <Button type="submit">
              <Plus size={18} /> {t('inventory.addItem')}
            </Button>
          </form>
        </Section>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Package size={26} strokeWidth={1.5} />}
          title={t('inventory.empty')}
          hint={t('inventory.emptyHint')}
        />
      ) : (
        groups.map(([location, groupItems]) => (
          <div key={location}>
            <h2 className="section-title section-title-spaced">{location}</h2>
            <div className="settings-list">
              {groupItems.map((item) => (
                <ListItem
                  key={item.id}
                  title={item.name}
                  trailing={
                    canEdit ? (
                      <>
                        <div className="kombuese-quantity">
                          <IconButton
                            label={t('inventory.decrease')}
                            onClick={() => adjustQuantity(item, -STEP)}
                          >
                            <Minus size={16} />
                          </IconButton>
                          <span className="kombuese-quantity-value">
                            {item.quantity} {item.unit}
                          </span>
                          <IconButton
                            label={t('inventory.increase')}
                            onClick={() => adjustQuantity(item, STEP)}
                          >
                            <Plus size={16} />
                          </IconButton>
                        </div>
                        <IconButton
                          label={t('inventory.deleteItem')}
                          tone="danger"
                          onClick={() => requestDelete(item.id!)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </>
                    ) : (
                      <span className="kombuese-quantity-value">
                        {item.quantity} {item.unit}
                      </span>
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('inventory.deleteTitle')}
        description={t('inventory.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
