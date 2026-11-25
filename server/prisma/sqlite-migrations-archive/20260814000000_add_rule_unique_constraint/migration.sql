-- Guarantees at most one Rule row per (scenario, attack, defense) pairing.
-- Lets ruleEngine.resolveOutcome() use findUnique (a single guaranteed row
-- or none) instead of findFirst (no uniqueness guarantee at the DB level).
CREATE UNIQUE INDEX "rules_scenarioId_attackType_defenseType_key" ON "rules"("scenarioId", "attackType", "defenseType");
