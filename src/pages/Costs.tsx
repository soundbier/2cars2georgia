import { useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
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
  ChevronDown,
  LucideIcon
} from 'lucide-react';
import { db } from '../firebase';
import { useCollection } from '../hooks/useCollection';
import { useRoadtrip, tripPath } from '../hooks/useRoadtrip';
import { useSoftDelete } from '../hooks/useSoftDelete';
import { trackWrite } from '../lib/pendingWrites';
import { activeOnly } from '../lib/trash';
import {
  computeSettlement,
  centsToEuro,
  SHARED_PAYER,
  Settlement as SettlementResult
} from '../lib/settlement';
import { useI18n, useT, TranslationKey } from '../i18n';
import { Expense, ExpenseCategory } from '../types';
import { Button, Input, Select, PageHeader, EmptyState, IconButton, ConfirmDialog, useToast } from '../components/ui';
import './Costs.css';

interface Props {
  user: string;
  users: string[];
}

const FALLBACK_CATEGORY: ExpenseCategory = 'sonstiges';

const CATEGORIES: { value: ExpenseCategory; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { value: 'verpflegung', labelKey: 'costs.category.verpflegung', icon: UtensilsCrossed },
  { value: 'tanken', labelKey: 'costs.category.tanken', icon: Fuel },
  { value: 'liegeplatz', labelKey: 'costs.category.liegeplatz', icon: DoorClosed },
  { value: 'schleuse', labelKey: 'costs.category.schleuse', icon: Anchor },
  { value: FALLBACK_CATEGORY, labelKey: 'costs.category.sonstiges', icon: MoreHorizontal }
];

const CATEGORY_BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));

const categoryMeta = (category: ExpenseCategory) =>
  CATEGORY_BY_VALUE.get(category) ?? CATEGORY_BY_VALUE.get(FALLBACK_CATEGORY)!;

/** Parst ein Betragsfeld (Komma oder Punkt) – gibt null bei ungültiger Eingabe zurück. */
function parseAmount(raw: string): number | null {
  const parsed = parseFloat(raw.replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Euro-Betrag im Format der Oberflächensprache: "12,50 €" auf Deutsch,
 * "€12.50" auf Englisch. Trennzeichen und Position folgen damit dem, was in
 * der jeweiligen Sprache erwartet wird, statt fest deutsch zu bleiben.
 */
function useFormatEuro() {
  const { locale } = useI18n();
  return useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
    return (amount: number) => formatter.format(amount);
  }, [locale]);
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
  const t = useT();
  const formatEuro = useFormatEuro();

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
      notify(t('costs.descriptionRequired'), 'danger');
      return;
    }
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      notify(t('costs.invalidAmount'), 'danger');
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
          placeholder={t('costs.descriptionShort')}
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t('costs.amountPlaceholder')}
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.labelKey)}
            </option>
          ))}
        </Select>
        <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value={SHARED_PAYER}>{t('costs.sharedPayer')}</option>
          {users.map((name) => (
            <option key={name} value={name}>
              {name === currentUser ? t('costs.self', { name }) : name}
            </option>
          ))}
          {/* Crewmitglied wurde inzwischen entfernt: Wert trotzdem anzeigen statt stillschweigend zu ersetzen */}
          {paidBy !== SHARED_PAYER && !users.includes(paidBy) && <option value={paidBy}>{paidBy}</option>}
        </Select>
        <div className="row costs-row-edit-actions">
          <Button fullWidth onClick={handleSave}>
            {t('common.save')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setIsEditing(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    );
  }

  const { icon: Icon, labelKey } = categoryMeta(expense.category);
  return (
    <div className="costs-row">
      <div className="costs-row-icon">
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <div className="costs-row-body">
        <div className="costs-row-title">{expense.title}</div>
        <div className="helper-text">
          {t(labelKey)} · {expense.paidBy === SHARED_PAYER ? t('costs.sharedPayer') : expense.paidBy}
        </div>
      </div>
      <div className="mono-num costs-row-amount">{formatEuro(expense.amountEuro)}</div>
      <div className="costs-row-actions">
        <IconButton label={t('costs.editExpense')} onClick={startEditing}>
          <Pencil size={16} />
        </IconButton>
        <IconButton label={t('costs.deleteExpense')} tone="danger" onClick={() => onRequestDelete(expense.id!)}>
          <Trash2 size={16} />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * „Wer schuldet wem wie viel“: kompakte Zusammenfassung mit dem eigenen Saldo,
 * Details (alle Salden und die kürzeste Zahlungsfolge) erst auf Tippen. Ausgaben
 * aus der Bordkasse tauchen hier nicht auf, da sie bereits gemeinsam finanziert sind.
 */
function Settlement({
  settlement,
  currentUser
}: {
  settlement: SettlementResult;
  currentUser: string;
}) {
  const { balances, transfers, splitTotalCents, sharedTotalCents } = settlement;
  const [isOpen, setIsOpen] = useState(false);
  const t = useT();
  const formatEuro = useFormatEuro();
  const formatCents = (cents: number) => formatEuro(centsToEuro(cents));

  if (splitTotalCents === 0 && sharedTotalCents === 0) return null;

  const ownBalanceCents = balances.find((b) => b.user === currentUser)?.balanceCents ?? 0;
  const summary =
    splitTotalCents === 0
      ? t('settlement.nothingToSettleShort')
      : ownBalanceCents > 0
        ? t('settlement.youGet', { amount: formatCents(ownBalanceCents) })
        : ownBalanceCents < 0
          ? t('settlement.youOwe', { amount: formatCents(-ownBalanceCents) })
          : t('settlement.youAreEven');
  const summaryTone =
    splitTotalCents === 0 || ownBalanceCents === 0
      ? 'settlement-summary-neutral'
      : ownBalanceCents > 0
        ? 'settlement-summary-positive'
        : 'settlement-summary-negative';

  return (
    <section className="settlement">
      <button
        type="button"
        className="settlement-header"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="settlement-header-title">{t('settlement.title')}</span>
        <span className={`settlement-summary ${summaryTone}`}>{summary}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`settlement-chevron ${isOpen ? 'settlement-chevron-open' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="settlement-details">
          {splitTotalCents === 0 ? (
            <p className="helper-text">{t('settlement.nothingToSettle')}</p>
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
                          {balance.user === currentUser
                            ? t('costs.self', { name: balance.user })
                            : balance.user}
                        </div>
                        <div className="helper-text settlement-balance-meta">
                          {t('settlement.laidOutAndShare', {
                            paid: formatCents(balance.paidCents),
                            share: formatCents(balance.shareCents)
                          })}
                        </div>
                      </div>
                      <div className={`mono-num settlement-balance-amount ${tone}`}>
                        {balance.balanceCents > 0 ? '+' : ''}
                        {formatCents(balance.balanceCents)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {transfers.length === 0 ? (
                <p className="helper-text settlement-note">{t('settlement.allSettled')}</p>
              ) : (
                <div className="settlement-transfers">
                  {transfers.map((transfer) => (
                    <div key={`${transfer.from}-${transfer.to}`} className="settlement-transfer">
                      <span className="settlement-transfer-party">{transfer.from}</span>
                      <ArrowRight size={13} strokeWidth={2} />
                      <span className="settlement-transfer-party">{transfer.to}</span>
                      <span className="mono-num settlement-transfer-amount">
                        {formatCents(transfer.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {sharedTotalCents > 0 && (
            <p className="helper-text settlement-note">
              {t('settlement.sharedNote', {
                amount: formatCents(sharedTotalCents),
                payer: t('costs.sharedPayer')
              })}
            </p>
          )}
        </div>
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
  const { deleteTargetId, requestDelete, cancelDelete, confirmDelete } = useSoftDelete(
    'expenses',
    'costs.expenseTrashed',
    'costs.expenseRestored'
  );
  const { notify } = useToast();
  const t = useT();
  const formatEuro = useFormatEuro();

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
      notify(t('costs.invalidAmount'), 'danger');
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
      notify(t('common.saveError'), 'danger');
    }
  };

  const handleSaveEdit = async (id: string, changes: ExpenseChanges) => {
    if (!tripId) return false;
    try {
      await trackWrite(updateDoc(doc(db, tripPath(tripId, 'expenses'), id), changes));
      notify(t('costs.expenseUpdated'), 'success');
      return true;
    } catch (err) {
      console.error(err);
      notify(t('common.saveError'), 'danger');
      return false;
    }
  };

  const total = expenses.reduce((sum, item) => sum + item.amountEuro, 0);

  return (
    <div>
      <PageHeader title={t('costs.title')} subtitle={t('costs.subtitle')} />

      <div className="costs-total-banner">
        <span className="label">{t('costs.total')}</span>
        <span className="mono-num costs-total-value">{formatEuro(total)}</span>
      </div>

      <form onSubmit={handleAdd} className="costs-form">
        <Input
          className="costs-form-title"
          placeholder={t('costs.descriptionPlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder={t('costs.amountPlaceholder')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.labelKey)}
            </option>
          ))}
        </Select>
        <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value={SHARED_PAYER}>{t('costs.sharedPayer')}</option>
          {users.map((name) => (
            <option key={name} value={name}>
              {name === user ? t('costs.self', { name }) : name}
            </option>
          ))}
        </Select>
        <Button type="submit">
          <Plus size={18} /> {t('costs.submit')}
        </Button>
      </form>

      <Settlement settlement={settlement} currentUser={user} />

      <h2 className="section-title section-title-spaced">{t('costs.history')}</h2>

      {expenses.length === 0 ? (
        <EmptyState title={t('costs.empty')} hint={t('costs.emptyHint')} />
      ) : (
        <div className="costs-list">
          {expenses.map((exp) => (
            <ExpenseRow
              key={exp.id}
              expense={exp}
              users={users}
              currentUser={user}
              onSave={handleSaveEdit}
              onRequestDelete={requestDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('costs.deleteTitle')}
        description={t('costs.deleteDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
