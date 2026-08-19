import { Dish, InventoryItem, MealPlanEntry } from '../types';
import { activeOnly } from './trash';

/**
 * Berechnet, was noch eingekauft werden muss: Summe der Zutaten aller
 * geplanten Gerichte, abzüglich dessen, was laut Lagerübersicht schon an
 * Bord ist.
 *
 * Zwei Zutaten werden nur zusammengezählt, wenn Name UND Einheit normalisiert
 * übereinstimmen (siehe `normalizeKey`) – es findet keine
 * Einheiten-Umrechnung statt (1 kg und 1000 g bleiben getrennte Zeilen).
 * Manuell zur Einkaufsliste hinzugefügte Posten (`ShoppingListExtra`) sind
 * hier bewusst nicht enthalten: Sie werden in der Oberfläche als eigener
 * Abschnitt geführt statt rechnerisch mit den Rezeptmengen verschmolzen, was
 * bei zufällig gleichlautenden, aber unterschiedlich gemeinten Posten zu
 * falschen Summen führen würde.
 */
export interface ShoppingListLine {
  /** Normalisierter Name+Einheit-Schlüssel, dient als shoppingListChecks-Dokument-ID. */
  key: string;
  name: string;
  unit: string;
  neededQuantity: number;
}

/** Trimmt und vereinheitlicht Groß-/Kleinschreibung, damit "Zwiebeln"/"zwiebeln " als dieselbe Zutat zählen. */
function normalizeKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

export function computeShoppingList(
  mealPlan: MealPlanEntry[],
  dishes: Dish[],
  inventory: InventoryItem[]
): ShoppingListLine[] {
  const dishById = new Map(activeOnly(dishes).map((dish) => [dish.id, dish]));

  const needed = new Map<string, { name: string; unit: string; quantity: number }>();
  for (const entry of activeOnly(mealPlan)) {
    const dish = dishById.get(entry.dishId);
    if (!dish) continue;
    for (const ingredient of dish.ingredients) {
      const key = normalizeKey(ingredient.name, ingredient.unit);
      const existing = needed.get(key);
      // Anzeigename/-einheit vom ersten Vorkommen, damit eine später
      // abweichende Schreibweise (z.B. Kleinschreibung) nicht die Anzeige
      // der schon summierten Zeile verändert.
      needed.set(key, {
        name: existing?.name ?? ingredient.name,
        unit: existing?.unit ?? ingredient.unit,
        quantity: (existing?.quantity ?? 0) + ingredient.quantity
      });
    }
  }

  const inStock = new Map<string, number>();
  for (const item of activeOnly(inventory)) {
    const key = normalizeKey(item.name, item.unit);
    inStock.set(key, (inStock.get(key) ?? 0) + item.quantity);
  }

  const lines: ShoppingListLine[] = [];
  for (const [key, { name, unit, quantity }] of needed) {
    const neededQuantity = quantity - (inStock.get(key) ?? 0);
    if (neededQuantity > 0) {
      lines.push({ key, name, unit, neededQuantity });
    }
  }

  return lines.sort((a, b) => a.name.localeCompare(b.name));
}
