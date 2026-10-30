// Pure selection logic for interleaved (mixed-category) practice sessions.
// Kept separate from session.routes.ts so it's unit-testable without Prisma.

export interface ScenarioLike {
  id: string;
  category: string;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Round-robins across the distinct categories present in `scenarios` (one
// scenario per category per lap, wrapping until `totalScenarios` is
// reached or every category is exhausted), then shuffles the resulting
// set's order — so a session draws roughly evenly across categories
// instead of blocking on whichever category happened to sort first, while
// still landing in a random round order.
export function buildInterleavedScenarioSet(scenarios: ScenarioLike[], totalScenarios: number): string[] {
  const byCategory = new Map<string, ScenarioLike[]>();
  for (const s of scenarios) {
    const bucket = byCategory.get(s.category);
    if (bucket) bucket.push(s);
    else byCategory.set(s.category, [s]);
  }
  for (const [category, items] of byCategory) {
    byCategory.set(category, shuffle(items));
  }

  const categories = shuffle([...byCategory.keys()]);
  const selected: ScenarioLike[] = [];
  let lap = 0;
  while (selected.length < totalScenarios) {
    let addedThisLap = false;
    for (const category of categories) {
      if (selected.length >= totalScenarios) break;
      const items = byCategory.get(category)!;
      if (lap < items.length) {
        selected.push(items[lap]);
        addedThisLap = true;
      }
    }
    if (!addedThisLap) break; // every category exhausted
    lap++;
  }

  return shuffle(selected).map((s) => s.id);
}
