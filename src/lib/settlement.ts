import { Expense } from '../types';

/**
 * Zahler-Kennung für Ausgaben, die direkt aus der gemeinsamen Bordkasse
 * beglichen wurden. Solche Ausgaben belasten niemanden persönlich und tauchen
 * deshalb im Ausgleich nicht auf – sie werden nur separat ausgewiesen.
 */
export const SHARED_PAYER = 'Bordkasse';

export interface Balance {
  user: string;
  /** Was diese Person selbst ausgelegt hat. */
  paidCents: number;
  /** Was auf diese Person entfällt (gleicher Anteil für alle Beteiligten). */
  shareCents: number;
  /** paid − share: positiv = bekommt Geld, negativ = schuldet Geld. */
  balanceCents: number;
}

export interface Transfer {
  from: string;
  to: string;
  amountCents: number;
}

export interface Settlement {
  /** Alle am Ausgleich Beteiligten (Crew + inzwischen entfernte Zahler). */
  participants: string[];
  balances: Balance[];
  /** Minimale Zahlungen, die alle Salden auf null bringen. */
  transfers: Transfer[];
  /** Summe der privat ausgelegten Ausgaben, die aufgeteilt werden. */
  splitTotalCents: number;
  /** Summe der direkt aus der Bordkasse bezahlten Ausgaben. */
  sharedTotalCents: number;
}

/**
 * Gerundet in ganzen Cent gerechnet: Euro-Beträge als Gleitkommazahl zu
 * summieren und erst am Ende zu runden würde bei vielen Einträgen Salden
 * erzeugen, die sich nicht exakt zu null addieren – der Ausgleich ginge dann
 * nie ganz auf.
 */
function toCents(amountEuro: number): number {
  return Math.round(amountEuro * 100);
}

export function centsToEuro(cents: number): number {
  return cents / 100;
}

export function formatEuro(cents: number): string {
  return `${centsToEuro(cents).toFixed(2)} €`;
}

/**
 * Beteiligte des Ausgleichs: die aktuelle Crew plus jede Person, die eine
 * Ausgabe ausgelegt hat. Letzteres deckt Crewmitglieder ab, die inzwischen aus
 * der Liste entfernt wurden – deren Auslagen dürfen nicht stillschweigend
 * verschwinden.
 */
function collectParticipants(expenses: Expense[], users: string[]): string[] {
  const participants = [...users];
  for (const expense of expenses) {
    if (expense.paidBy === SHARED_PAYER) continue;
    if (!participants.includes(expense.paidBy)) participants.push(expense.paidBy);
  }
  return participants;
}

export function computeSettlement(expenses: Expense[], users: string[]): Settlement {
  const participants = collectParticipants(expenses, users);

  let sharedTotalCents = 0;
  const paidByUser = new Map<string, number>(participants.map((name) => [name, 0]));

  for (const expense of expenses) {
    const cents = toCents(expense.amountEuro);
    if (expense.paidBy === SHARED_PAYER) {
      sharedTotalCents += cents;
    } else {
      paidByUser.set(expense.paidBy, (paidByUser.get(expense.paidBy) ?? 0) + cents);
    }
  }

  const splitTotalCents = participants.reduce((sum, name) => sum + (paidByUser.get(name) ?? 0), 0);

  if (participants.length === 0) {
    return { participants, balances: [], transfers: [], splitTotalCents, sharedTotalCents };
  }

  // Restcent-Verteilung: Die ersten `remainder` Beteiligten tragen je einen
  // Cent mehr, damit die Summe aller Anteile exakt dem Gesamtbetrag entspricht.
  const baseShare = Math.floor(splitTotalCents / participants.length);
  const remainder = splitTotalCents - baseShare * participants.length;

  const balances: Balance[] = participants.map((user, index) => {
    const paidCents = paidByUser.get(user) ?? 0;
    const shareCents = baseShare + (index < remainder ? 1 : 0);
    return { user, paidCents, shareCents, balanceCents: paidCents - shareCents };
  });

  return {
    participants,
    balances,
    transfers: settleBalances(balances),
    splitTotalCents,
    sharedTotalCents
  };
}

/**
 * Führt die Salden auf möglichst wenige Zahlungen zurück: Der größte Schuldner
 * zahlt an den größten Gläubiger, bis eine der beiden Seiten ausgeglichen ist.
 * Das ist nicht beweisbar das globale Optimum, liefert aber bei Crew-Größen
 * dieser Größenordnung stets eine kurze, nachvollziehbare Liste.
 */
export function settleBalances(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ user: b.user, amount: -b.balanceCents }))
    .sort((a, b) => b.amount - a.amount || a.user.localeCompare(b.user));

  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ user: b.user, amount: b.balanceCents }))
    .sort((a, b) => b.amount - a.amount || a.user.localeCompare(b.user));

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.amount, creditor.amount);

    transfers.push({ from: debtor.user, to: creditor.user, amountCents });

    debtor.amount -= amountCents;
    creditor.amount -= amountCents;
    if (debtor.amount === 0) debtorIndex++;
    if (creditor.amount === 0) creditorIndex++;
  }

  return transfers;
}
