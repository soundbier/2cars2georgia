import { describe, expect, it } from 'vitest';
import { computeShoppingList } from './shoppingList';
import { Dish, InventoryItem, MealPlanEntry } from '../types';

const paprikaCurry: Dish = {
  id: 'curry',
  name: 'Rotes Thai-Curry',
  mealType: 'dinner',
  ingredients: [
    { name: 'Paprika', quantity: 4, unit: 'Stück' },
    { name: 'Kokosmilch', quantity: 1, unit: 'Dose' }
  ],
  author: 'Leon',
  timestamp: 1
};

const paprikaWraps: Dish = {
  id: 'wraps',
  name: 'Wraps mit Paprika',
  mealType: 'lunch',
  ingredients: [{ name: 'paprika', quantity: 2, unit: 'stück' }], // andere Schreibweise, muss trotzdem summieren
  author: 'Leon',
  timestamp: 1
};

function entry(dishId: string, date = '2026-07-03'): MealPlanEntry {
  return { id: `${dishId}-${date}`, date, mealType: 'dinner', dishId, author: 'Leon', timestamp: 1 };
}

describe('computeShoppingList', () => {
  it('summiert Zutaten über mehrere Gerichte, normalisiert nach Name und Einheit', () => {
    const lines = computeShoppingList([entry('curry'), entry('wraps')], [paprikaCurry, paprikaWraps], []);

    const paprika = lines.find((l) => l.name === 'Paprika');
    expect(paprika?.neededQuantity).toBe(6);
  });

  it('zieht den Lagerbestand ab', () => {
    const inventory: InventoryItem[] = [
      { id: 'i1', name: 'Paprika', quantity: 3, unit: 'Stück', location: 'Bilge', author: 'Leon', timestamp: 1 }
    ];
    const lines = computeShoppingList([entry('curry')], [paprikaCurry], inventory);

    expect(lines.find((l) => l.name === 'Paprika')?.neededQuantity).toBe(1);
  });

  it('lässt eine Zutat weg, sobald genug oder mehr als genug im Lager ist', () => {
    const inventory: InventoryItem[] = [
      { id: 'i1', name: 'Paprika', quantity: 10, unit: 'Stück', location: 'Bilge', author: 'Leon', timestamp: 1 }
    ];
    const lines = computeShoppingList([entry('curry')], [paprikaCurry], inventory);

    expect(lines.find((l) => l.name === 'Paprika')).toBeUndefined();
  });

  it('rechnet unterschiedliche Einheiten nicht ineinander um', () => {
    const inventory: InventoryItem[] = [
      { id: 'i1', name: 'Kokosmilch', quantity: 400, unit: 'g', location: 'Trockenlager', author: 'Leon', timestamp: 1 }
    ];
    const lines = computeShoppingList([entry('curry')], [paprikaCurry], inventory);

    // "Dose" und "g" bleiben getrennt – der Lagerbestand in Gramm deckt den
    // Bedarf in Dosen nicht ab.
    expect(lines.find((l) => l.name === 'Kokosmilch')?.neededQuantity).toBe(1);
  });

  it('ignoriert gelöschte Speiseplan-Einträge und gelöschte Gerichte', () => {
    const deletedEntry = { ...entry('curry'), deletedAt: Date.now() };
    expect(computeShoppingList([deletedEntry], [paprikaCurry], [])).toHaveLength(0);

    const deletedDish = { ...paprikaCurry, deletedAt: Date.now() };
    expect(computeShoppingList([entry('curry')], [deletedDish], [])).toHaveLength(0);
  });

  it('ignoriert Speiseplan-Einträge ohne bekanntes Gericht', () => {
    expect(computeShoppingList([entry('unbekannt')], [paprikaCurry], [])).toHaveLength(0);
  });

  it('sortiert alphabetisch nach Name', () => {
    const lines = computeShoppingList([entry('curry')], [paprikaCurry], []);
    expect(lines.map((l) => l.name)).toEqual(['Kokosmilch', 'Paprika']);
  });
});
