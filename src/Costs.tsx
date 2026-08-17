import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Fuel, UtensilsCrossed, Anchor, DoorClosed, MoreHorizontal, Plus } from 'lucide-react';
import { db } from './firebase';
import { Expense } from './types';
import { Button, Input, Select, PageHeader, EmptyState, useToast } from './components/ui';
import './Costs.css';

interface Props {
  user: string;
  users: string[];
}

const CATEGORIES: { value: Expense['category']; label: string; icon: typeof Fuel }[] = [
  { value: 'verpflegung', label: 'Verpflegung', icon: UtensilsCrossed },
  { value: 'tanken', label: 'Tanken', icon: Fuel },
  { value: 'liegeplatz', label: 'Liegeplatz', icon: DoorClosed },
  { value: 'schleuse', label: 'Schleuse', icon: Anchor },
  { value: 'sonstiges', label: 'Sonstiges', icon: MoreHorizontal }
];

function categoryMeta(category: Expense['category']) {
  return CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[CATEGORIES.length - 1];
}

export default function Costs({ user, users }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('verpflegung');
  const [paidBy, setPaidBy] = useState(user);
  const { notify } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Expense[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(list);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount)) {
      notify('Ungültiger Betrag.', 'danger');
      return;
    }

    const newExpense: Expense = {
      timestamp: Date.now(),
      author: user,
      paidBy,
      title,
      amountEuro: parsedAmount,
      category
    };

    try {
      await addDoc(collection(db, 'expenses'), newExpense);
      setTitle('');
      setAmount('');
    } catch (err) {
      console.error(err);
      notify('Fehler beim Speichern.', 'danger');
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
        <Select value={category} onChange={(e) => setCategory(e.target.value as Expense['category'])}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value="Bordkasse">Bordkasse</option>
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

      <div className="section-title" style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>
        Verlauf
      </div>

      {expenses.length === 0 ? (
        <EmptyState title="Noch keine Ausgaben" hint="Die erste Ausgabe der Reise oben eintragen." />
      ) : (
        <div className="costs-list">
          {expenses.map((exp) => {
            const meta = categoryMeta(exp.category);
            const Icon = meta.icon;
            return (
              <div key={exp.id} className="costs-row">
                <div className="costs-row-icon">
                  <Icon size={17} strokeWidth={1.75} />
                </div>
                <div className="costs-row-body">
                  <div className="costs-row-title">{exp.title}</div>
                  <div className="helper-text">
                    {meta.label} · {exp.paidBy}
                  </div>
                </div>
                <div className="mono-num costs-row-amount">{exp.amountEuro.toFixed(2)} €</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
