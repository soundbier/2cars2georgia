import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
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

  return (
    <div>
      <h2 style={{ marginBottom: '16px' }}>Kosten ({total.toFixed(2)} €)</h2>
      
      <form onSubmit={handleAdd} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3>Ausgabe eintragen</h3>
        <input 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
          placeholder="Beschreibung (z.B. Diesel, Einkauf)" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          required 
        />
        <input 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
          type="number" 
          step="0.01" 
          placeholder="Betrag in €" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)} 
          required 
        />
        <select 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
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
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
          value={paidBy} 
          onChange={(e) => setPaidBy(e.target.value)}
        >
          <option value="Ich">Bezahlt von: Ich</option>
          <option value="Freundin">Bezahlt von: Freundin</option>
        </select>
        <button type="submit" className="btn" style={{ marginTop: '8px' }}>Speichern</button>
      </form>

      <h3 style={{ marginBottom: '12px' }}>Verlauf</h3>
      {expenses.map((exp) => (
        <div key={exp.id} className="card" style={{ marginBottom: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{exp.title}</strong>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {exp.category} | {exp.paidBy} | {new Date(exp.timestamp).toLocaleDateString()}
            </div>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
            {exp.amountEuro.toFixed(2)} €
          </div>
        </div>
      ))}
    </div>
  );
}
