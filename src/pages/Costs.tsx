import { useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import {
  Fuel,
  UtensilsCrossed,
  Anchor,
  DoorClosed,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  LucideIcon
} from 'lucide-react';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { trackWrite } from '../lib/pendingWrites';
import { activeOnly } from '../lib/trash';
import {
  computeSettlement,
  formatEuro,
  SHARED_PAYER,
  Settlement as SettlementResult
} from '../lib/settlement';
import { Expense, ExpenseCategory } from '../types';
import { Button, Input, Select, PageHeader, EmptyState, IconButton, ConfirmDialog, useToast } from '../components/ui';
import './Costs.css';

interface Props {
  user: string;
  users: string[];
}

const FALLBACK_CATEGORY: ExpenseCategory = 'sonstiges';

const CATEGORIES: { value: ExpenseCategory; label: string; icon: LucideIcon }[] = [
  { value: 'verpflegung', label: 'Verpflegung', icon: UtensilsCrossed },
  { value: 'tanken', label: 'Tanken', icon: Fuel },
  { value: 'liegeplatz', label: 'Liegeplatz', icon: DoorClosed },
  { value: 'schleuse', label: 'Schleuse', icon: Anchor },
  { value: FALLBACK_CATEGORY, label: 'Sonstiges', icon: MoreHorizontal }
];

const CATEGORY_BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));

const categoryMeta = (category: ExpenseCategory) =>
  CATEGORY_BY_VALUE.get(category) ?? CATEGORY_BY_VALUE.get(FALLBACK_CATEGORY)!;

/** Parst ein Betragsfeld (Komma oder Punkt) – gibt null bei ungültiger Eingabe zurück. */
function parseAmount(raw: string): number | null {
  const parsed = parseFloat(raw.replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

type ExpenseChanges = Pick<Expense, 'title' | 'amountEuro' | 'category' | 'paidBy'>;

interface ExpenseRowProps {
  expense: Expense;
  users: string[];
  currentUser: string;
  onSave: (id: string, changes: ExpenseChanges) => Promise<boolean>;
  onRequestDelete: (id: string) => void;
}

function ExpenseRow({ expense, users, currentUser, onSave, onRequestDelete }: ExpenseRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(expense.title);
  const [amount, setAmount] = useState(String(expense.amountEuro));
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [paidBy, setPaidBy] = useState(expense.paidBy);
  const { notify } = useToast();

  const startEditing = () => {
    setTitle(expense.title);
    setAmount(String(expense.amountEuro));
    setCategory(expense.category);
    setPaidBy(expense.paidBy);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      notify('Beschreibung darf nicht leer sein.', 'danger');
      return;
    }
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      notify('Ungültiger Betrag.', 'danger');
      return;
    }
    const saved = await onSave(expense.id!, {
      title: trimmedTitle,
      amountEuro: parsedAmount,
      category,
      paidBy
    });
    if (saved) setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="costs-row-edit">
        <Input
          autoFocus
          className="costs-row-edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Beschreibung"
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Betrag in €"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value={SHARED_PAYER}>{SHARED_PAYER}</option>
          {users.map((name) => (
            <option key={name} value={name}>
              {name === currentUser ? `Ich (${name})` : name}
            </option>
          ))}
          {/* Crewmitglied wurde inzwischen entfernt: Wert trotzdem anzeigen statt stillschweigend zu ersetzen */}
          {paidBy !== SHARED_PAYER && !users.includes(paidBy) && <option value={paidBy}>{paidBy}</option>}
        </Select>
        <div className="row costs-row-edit-actions">
          <Button fullWidth onClick={handleSave}>
            Speichern
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setIsEditing(false)}>
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  const { icon: Icon, label } = categoryMeta(expense.category);
  return (
    <div className="costs-row">
      <div className="costs-row-icon">
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <div className="costs-row-body">
        <div className="costs-row-title">{expense.title}</div>
        <div className="helper-text">
          {label} · {expense.paidBy}
        </div>
      </div>
      <div className="mono-num costs-row-amount">{expense.amountEuro.toFixed(2)} €</div>
      <div className="costs-row-actions">
        <IconButton label="Ausgabe bearbeiten" onClick={startEditing}>
          <Pencil size={16} />
        </IconButton>
        <IconButton label="Ausgabe löschen" tone="danger" onClick={() => onRequestDelete(expense.id!)}>
          <Trash2 size={16} />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * „Wer schuldet wem wie viel“: Salden je Crewmitglied plus die kürzeste Folge
 * von Zahlungen, die alles glattstellt. Ausgaben aus der Bordkasse tauchen hier
 * nicht auf, da sie bereits gemeinsam finanziert sind.
 */
function Settlement({
  settlement,
  currentUser
}: {
  settlement: SettlementResult;
  currentUser: string;
}) {
  const { balances, transfers, splitTotalCents, sharedTotalCents } = settlement;

  if (splitTotalCents === 0 && sharedTotalCents === 0) return null;

  return (
    <section className="settlement">
      <h2 className="section-title section-title-spaced">Ausgleich</h2>

      {splitTotalCents === 0 ? (
        <p className="helper-text">
          Bisher wurde alles direkt aus der Bordkasse bezahlt – es gibt nichts zu verrechnen.
        </p>
      ) : (
        <>
          <div className="settlement-balances">
            {balances.map((balance) => {
              const tone =
                balance.balanceCents > 0
                  ? 'settlement-balance-positive'
                  : balance.balanceCents < 0
                    ? 'settlement-balance-negative'
                    : 'settlement-balance-neutral';
              return (
                <div key={balance.user} className="settlement-balance">
                  <div className="settlement-balance-body">
                    <div className="settlement-balance-name">
                      {balance.user === currentUser ? `Ich (${balance.user})` : balance.user}
                    </div>
                    <div className="helper-text">
                      {formatEuro(balance.paidCents)} ausgelegt · {formatEuro(balance.shareCents)} Anteil
                    </div>
                  </div>
                  <div className={`mono-num settlement-balance-amount ${tone}`}>
                    {balance.balanceCents > 0 ? '+' : ''}
                    {formatEuro(balance.balanceCents)}
                  </div>
                </div>
              );
            })}
          </div>

          {transfers.length === 0 ? (
            <p className="helper-text settlement-note">Alle Salden sind bereits ausgeglichen.</p>
          ) : (
            <div className="settlement-transfers">
              {transfers.map((transfer) => (
                <div key={`${transfer.from}-${transfer.to}`} className="settlement-transfer">
                  <span className="settlement-transfer-party">{transfer.from}</span>
                  <ArrowRight size={15} strokeWidth={2} />
                  <span className="settlement-transfer-party">{transfer.to}</span>
                  <span className="mono-num settlement-transfer-amount">
                    {formatEuro(transfer.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sharedTotalCents > 0 && (
        <p className="helper-text settlement-note">
          {formatEuro(sharedTotalCents)} wurden direkt aus der {SHARED_PAYER} bezahlt und bleiben
          außen vor.
        </p>
      )}
    </section>
  );
}

export default function Costs({ user, users }: Props) {
  const { tripId } = useRoadtrip();
  const allExpenses = useCollection<Expense>(tripId ? tripPath(tripId, 'expenses') : null, 'timestamp', 'desc');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('verpflegung');
  const [paidBy, setPaidBy] = useState(user);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { notify } = useToast();

  // Ausgaben im Papierkorb zählen weder im Verlauf noch im Ausgleich mit.
  const expenses = useMemo(() => activeOnly(allExpenses), [allExpenses]);
  const settlement = useMemo(() => computeSettlement(expenses, users), [expenses, users]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      notify('Ungültiger Betrag.', 'danger');
      return;
    }

    const newExpense: Expense = {
      timestamp: Date.now(),
      author: user,
      paidBy,
      title: trimmedTitle,
      amountEuro: parsedAmount,
      category
    };

    try {
      await trackWrite(addDoc(collection(db, tripPath(tripId, 'expenses')), newExpense));
      setTitle('');
      setAmount('');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
    }
  };

  const handleSaveEdit = async (id: string, changes: ExpenseChanges) => {
    if (!tripId) return false;
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'expenses'), id), changes));
      notify('Ausgabe aktualisiert', 'success');
      return true;
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
      return false;
    }
  };

  const restoreExpense = async (id: string) => {
    if (!tripId) return;
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'expenses'), id), { deletedAt: deleteField() }));
      notify('Ausgabe wiederhergestellt', 'success');
    } catch (err) {
      console.error(err);
      notify('Wiederherstellen fehlgeschlagen.', 'danger');
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTargetId || !tripId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'expenses'), id), { deletedAt: Date.now() }));
      notify('Ausgabe in den Papierkorb verschoben', 'success', {
        label: 'Rückgängig',
        onAct: () => void restoreExpense(id)
      });
    } catch (err) {
      console.error(err);
      notify('Fehler beim Löschen.', 'danger');
    }
  };

  const total = expenses.reduce((sum, item) => sum + item.amountEuro, 0);

  return (
    <div>
      <PageHeader title="Reisekasse" subtitle="Ausgaben der Crew erfassen und im Blick behalten" />

      <div className="costs-total-banner">
        <span className="label">Gesamtausgaben</span>
        <span className="mono-num costs-total-value">{total.toFixed(2)} €</span>
      </div>

      <form onSubmit={handleAdd} className="costs-form">
        <Input
          className="costs-form-title"
          placeholder="Beschreibung, z.B. Diesel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="Betrag in €"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value={SHARED_PAYER}>{SHARED_PAYER}</option>
          {users.map((name) => (
            <option key={name} value={name}>
              {name === user ? `Ich (${name})` : name}
            </option>
          ))}
        </Select>
        <Button type="submit">
          <Plus size={18} /> Eintragen
        </Button>
      </form>

      <Settlement settlement={settlement} currentUser={user} />

      <h2 className="section-title section-title-spaced">Verlauf</h2>

      {expenses.length === 0 ? (
        <EmptyState title="Noch keine Ausgaben" hint="Die erste Ausgabe der Reise oben eintragen." />
      ) : (
        <div className="costs-list">
          {expenses.map((exp) => (
            <ExpenseRow
              key={exp.id}
              expense={exp}
              users={users}
              currentUser={user}
              onSave={handleSaveEdit}
              onRequestDelete={setDeleteTargetId}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="Ausgabe löschen"
        description="Der Eintrag wandert in den Papierkorb und lässt sich unter Mehr → Papierkorb wiederherstellen."
        confirmLabel="Löschen"
        destructive
        onConfirm={handleDeleteExpense}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
