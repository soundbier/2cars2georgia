import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Receipt, Plus, Euro } from 'lucide-react';
import { db } from './firebase';
import { Expense } from './types';

interface Props {
  user: string;
}

export default function Costs({ user }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('verpflegung');
  const [paidBy, setPaidBy] = useState(user);

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

    const newExpense: Expense = {
      timestamp: Date.now(),
      author: user,
      paidBy,
      title,
      amountEuro: parseFloat(amount.replace(',', '.')),
      category
    };

    await addDoc(collection(db, 'expenses'), newExpense);
    setTitle('');
    setAmount('');
  };

  const total = expenses.reduce((sum, item) => sum + item.amountEuro, 0);

  const inputStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid var(--surface-border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '1rem',
    marginBottom: '12px',
    outline: 'none'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Kosten</h2>
        <div style={{ background: 'var(--primary)', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {total.toFixed(2)} <Euro size={16} />
        </div>
      </div>
      
      <form onSubmit={handleAdd} className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Receipt size={20} color="var(--primary)" />
          Ausgabe eintragen
        </h3>
        
        <input 
          style={inputStyle}
          placeholder="Beschreibung (z.B. Diesel, Einkauf)" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          required 
        />
        <input 
          style={inputStyle}
          type="number" 
          step="0.01" 
          placeholder="Betrag in €" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)} 
          required 
        />
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <select 
            style={{ ...inputStyle, marginBottom: 0 }}
            value={category} 
            onChange={(e) => setCategory(e.target.value as Expense['category'])}
          >
            <option value="verpflegung">Verpflegung</option>
            <option value="tanken">Tanken</option>
            <option value="liegeplatz">Liegeplatz</option>
            <option value="schleuse">Schleuse</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
          <select 
            style={{ ...inputStyle, marginBottom: 0 }}
            value={paidBy} 
            onChange={(e) => setPaidBy(e.target.value)}
          >
            <option value={user}>Ich ({user})</option>
            <option value="Bordkasse">Bordkasse</option>
          </select>
        </div>
        
        <button type="submit" className="btn" style={{ width: '100%', marginTop: '8px' }}>
          <Plus size={20} /> Speichern
        </button>
      </form>

      <h3 style={{ margin: '24px 0 16px' }}>Verlauf</h3>
      {expenses.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Noch keine Ausgaben erfasst.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {expenses.map((exp) => (
            <div key={exp.id} className="card" style={{ margin: 0, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem', marginBottom: '4px' }}>{exp.title}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {exp.category} • Bezahlt von: {exp.paidBy}
                </div>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text)' }}>
                {exp.amountEuro.toFixed(2)} €
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
