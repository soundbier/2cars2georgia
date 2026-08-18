import { describe, it, expect } from 'vitest';
import { computeSettlement, settleBalances, SHARED_PAYER, formatEuro } from './settlement';
import { Expense } from '../types';

function expense(paidBy: string, amountEuro: number): Expense {
  return {
    timestamp: 1_700_000_000_000,
    author: paidBy,
    paidBy,
    title: 'Test',
    amountEuro,
    category: 'sonstiges'
  };
}

describe('computeSettlement', () => {
  it('teilt private Auslagen gleichmäßig auf die Crew auf', () => {
    const result = computeSettlement([expense('Lukas', 30)], ['Lukas', 'Leon', 'Niklas']);

    expect(result.splitTotalCents).toBe(3000);
    expect(result.balances).toEqual([
      { user: 'Lukas', paidCents: 3000, shareCents: 1000, balanceCents: 2000 },
      { user: 'Leon', paidCents: 0, shareCents: 1000, balanceCents: -1000 },
      { user: 'Niklas', paidCents: 0, shareCents: 1000, balanceCents: -1000 }
    ]);
  });

  it('lässt Bordkassen-Ausgaben aus dem Ausgleich heraus', () => {
    const result = computeSettlement(
      [expense(SHARED_PAYER, 50), expense('Lukas', 10)],
      ['Lukas', 'Leon']
    );

    expect(result.sharedTotalCents).toBe(5000);
    expect(result.splitTotalCents).toBe(1000);
    expect(result.transfers).toEqual([{ from: 'Leon', to: 'Lukas', amountCents: 500 }]);
  });

  it('verteilt Restcents, sodass die Salden exakt aufgehen', () => {
    const result = computeSettlement([expense('Lukas', 10)], ['Lukas', 'Leon', 'Niklas']);

    const shareSum = result.balances.reduce((sum, b) => sum + b.shareCents, 0);
    const balanceSum = result.balances.reduce((sum, b) => sum + b.balanceCents, 0);

    expect(shareSum).toBe(1000);
    expect(balanceSum).toBe(0);
    expect(result.balances.map((b) => b.shareCents)).toEqual([334, 333, 333]);
  });

  it('summiert Cent-Beträge ohne Gleitkomma-Drift', () => {
    const expenses = Array.from({ length: 3 }, () => expense('Lukas', 0.1));
    const result = computeSettlement(expenses, ['Lukas', 'Leon']);

    expect(result.splitTotalCents).toBe(30);
  });

  it('behält Auslagen entfernter Crewmitglieder im Ausgleich', () => {
    const result = computeSettlement([expense('Elias', 20)], ['Lukas', 'Leon']);

    expect(result.participants).toEqual(['Lukas', 'Leon', 'Elias']);
    expect(result.balances.find((b) => b.user === 'Elias')?.balanceCents).toBeGreaterThan(0);
  });

  it('liefert ohne Ausgaben keine Zahlungen', () => {
    const result = computeSettlement([], ['Lukas', 'Leon']);

    expect(result.transfers).toEqual([]);
    expect(result.balances.every((b) => b.balanceCents === 0)).toBe(true);
  });

  it('kommt ohne Beteiligte zurecht', () => {
    const result = computeSettlement([], []);

    expect(result.participants).toEqual([]);
    expect(result.balances).toEqual([]);
    expect(result.transfers).toEqual([]);
  });
});

describe('settleBalances', () => {
  it('gleicht mehrere Schuldner und Gläubiger vollständig aus', () => {
    const balances = [
      { user: 'A', paidCents: 0, shareCents: 0, balanceCents: 600 },
      { user: 'B', paidCents: 0, shareCents: 0, balanceCents: 400 },
      { user: 'C', paidCents: 0, shareCents: 0, balanceCents: -700 },
      { user: 'D', paidCents: 0, shareCents: 0, balanceCents: -300 }
    ];

    const transfers = settleBalances(balances);

    // Jeder Saldo muss durch die Zahlungen exakt auf null gehen.
    const net = new Map(balances.map((b) => [b.user, b.balanceCents]));
    for (const t of transfers) {
      net.set(t.from, net.get(t.from)! + t.amountCents);
      net.set(t.to, net.get(t.to)! - t.amountCents);
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true);

    // Bei n Beteiligten mit Saldo reichen höchstens n − 1 Zahlungen.
    expect(transfers.length).toBeLessThanOrEqual(3);
  });
});

describe('formatEuro', () => {
  it('zeigt Cent-Beträge als Euro mit zwei Nachkommastellen', () => {
    expect(formatEuro(1234)).toBe('12.34 €');
    expect(formatEuro(0)).toBe('0.00 €');
  });
});
