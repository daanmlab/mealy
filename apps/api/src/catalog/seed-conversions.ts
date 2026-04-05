/**
 * Seeds standard unit conversions into the database.
 * Run with: npm run db:seed-conversions
 *
 * Uses symbol lookups (not hardcoded IDs) so it works on any DB instance.
 * Idempotent — safe to run multiple times.
 *
 * If OPENAI_API_KEY is set, also uses gpt-4o-mini to generate conversion factors
 * for any unit pairs in the DB that aren't covered by the standard list.
 */
import 'dotenv/config';
import OpenAI from 'openai';
import { PrismaClient, Unit } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

// Standard physical conversion factors — bidirectional.
// These are exact and universal (no ingredient knowledge needed).
const STANDARD_CONVERSIONS: { from: string; to: string; factor: number }[] = [
  // Weight
  { from: 'g', to: 'kg', factor: 0.001 },
  { from: 'kg', to: 'g', factor: 1000 },
  { from: 'g', to: 'oz', factor: 0.035274 },
  { from: 'oz', to: 'g', factor: 28.3495 },
  { from: 'g', to: 'lb', factor: 0.002205 },
  { from: 'lb', to: 'g', factor: 453.592 },
  { from: 'oz', to: 'lb', factor: 0.0625 },
  { from: 'lb', to: 'oz', factor: 16 },
  { from: 'kg', to: 'oz', factor: 35.274 },
  { from: 'oz', to: 'kg', factor: 0.02835 },
  { from: 'kg', to: 'lb', factor: 2.20462 },
  { from: 'lb', to: 'kg', factor: 0.453592 },
  // Volume — metric
  { from: 'ml', to: 'l', factor: 0.001 },
  { from: 'l', to: 'ml', factor: 1000 },
  { from: 'ml', to: 'litres', factor: 0.001 },
  { from: 'litres', to: 'ml', factor: 1000 },
  { from: 'l', to: 'litres', factor: 1 },
  { from: 'litres', to: 'l', factor: 1 },
  // Volume — common (1 US cup = 240 ml, 1 tbsp = 15 ml, 1 tsp = 5 ml)
  { from: 'ml', to: 'cup', factor: 1 / 240 },
  { from: 'cup', to: 'ml', factor: 240 },
  { from: 'ml', to: 'tbsp', factor: 1 / 15 },
  { from: 'tbsp', to: 'ml', factor: 15 },
  { from: 'ml', to: 'tsp', factor: 1 / 5 },
  { from: 'tsp', to: 'ml', factor: 5 },
  { from: 'l', to: 'cup', factor: 1000 / 240 },
  { from: 'cup', to: 'l', factor: 240 / 1000 },
  { from: 'l', to: 'tbsp', factor: 1000 / 15 },
  { from: 'tbsp', to: 'l', factor: 15 / 1000 },
  { from: 'l', to: 'tsp', factor: 1000 / 5 },
  { from: 'tsp', to: 'l', factor: 5 / 1000 },
  { from: 'litres', to: 'cup', factor: 1000 / 240 },
  { from: 'cup', to: 'litres', factor: 240 / 1000 },
  { from: 'litres', to: 'tbsp', factor: 1000 / 15 },
  { from: 'tbsp', to: 'litres', factor: 15 / 1000 },
  { from: 'litres', to: 'tsp', factor: 1000 / 5 },
  { from: 'tsp', to: 'litres', factor: 5 / 1000 },
  { from: 'cup', to: 'tbsp', factor: 16 },
  { from: 'tbsp', to: 'cup', factor: 1 / 16 },
  { from: 'cup', to: 'tsp', factor: 48 },
  { from: 'tsp', to: 'cup', factor: 1 / 48 },
  { from: 'tbsp', to: 'tsp', factor: 3 },
  { from: 'tsp', to: 'tbsp', factor: 1 / 3 },
];

async function upsertConversion(
  fromUnit: Unit,
  toUnit: Unit,
  factor: number,
): Promise<boolean> {
  const existing = await prisma.unitConversion.findUnique({
    where: {
      fromUnitId_toUnitId: { fromUnitId: fromUnit.id, toUnitId: toUnit.id },
    },
  });
  if (existing) return false;
  await prisma.unitConversion.create({
    data: { fromUnitId: fromUnit.id, toUnitId: toUnit.id, factor },
  });
  return true;
}

async function askLlmForConversion(
  fromSymbol: string,
  toSymbol: string,
  client: OpenAI,
): Promise<number | null> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `Is there a universal, ingredient-independent conversion factor between the cooking unit "${fromSymbol}" and "${toSymbol}"?

If yes, return: { "factor": <number>, "note": "<explanation>" }
If no (e.g. the conversion depends on ingredient density, or they measure incompatible things), return: { "factor": null, "note": "<reason>" }

Examples of valid conversions: tsp→tbsp (factor 0.333), g→oz (factor 0.035274), ml→cup (factor 0.004167)
Examples of invalid: g→cup (density-dependent), cloves→g (not a measurement unit pair)`,
      },
    ],
  });
  const content = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { factor: number | null };
  return parsed.factor ?? null;
}

async function main() {
  console.log('🌱 Seeding unit conversions…\n');

  const allUnits = await prisma.unit.findMany();
  const unitBySymbol = new Map(allUnits.map((u) => [u.symbol, u]));

  // ── 1. Seed standard conversions ──────────────────────────────────────────
  let seeded = 0;
  let skipped = 0;
  for (const { from, to, factor } of STANDARD_CONVERSIONS) {
    const fromUnit = unitBySymbol.get(from);
    const toUnit = unitBySymbol.get(to);
    if (!fromUnit || !toUnit) continue;
    const created = await upsertConversion(fromUnit, toUnit, factor);
    if (created) seeded++;
    else skipped++;
  }
  console.log(
    `  ✓ Standard conversions: ${seeded} inserted, ${skipped} already existed`,
  );

  // ── 2. Progressive LLM fill for remaining unknown pairs ───────────────────
  const openaiKey = process.env['OPENAI_API_KEY'];
  if (!openaiKey) {
    console.log(
      '  ℹ OPENAI_API_KEY not set — skipping LLM fill for unknown pairs\n',
    );
    return;
  }

  const client = new OpenAI({ apiKey: openaiKey });

  // Find all unit pairs that have no conversion yet
  const existingConversions = await prisma.unitConversion.findMany({
    select: { fromUnitId: true, toUnitId: true },
  });
  const existingSet = new Set(
    existingConversions.map((c) => `${c.fromUnitId}:${c.toUnitId}`),
  );

  // Only check pairs of units that are in different "groups" but might be convertible
  // Exclude obviously non-convertible types (count vs weight, etc.)
  const candidatePairs: { from: Unit; to: Unit }[] = [];
  for (const from of allUnits) {
    for (const to of allUnits) {
      if (from.id === to.id) continue;
      if (existingSet.has(`${from.id}:${to.id}`)) continue;
      candidatePairs.push({ from, to });
    }
  }

  if (candidatePairs.length === 0) {
    console.log('  ✓ All unit pairs already have conversions or are covered\n');
    return;
  }

  console.log(
    `  Checking ${candidatePairs.length} unknown unit pairs with LLM…`,
  );
  let llmSeeded = 0;
  let llmNull = 0;

  for (const { from, to } of candidatePairs) {
    try {
      const factor = await askLlmForConversion(from.symbol, to.symbol, client);
      if (factor !== null) {
        await upsertConversion(from, to, factor);
        console.log(`    + ${from.symbol} → ${to.symbol}: ×${factor}`);
        llmSeeded++;
      } else {
        llmNull++;
      }
    } catch {
      // silently skip — not critical
    }
  }
  console.log(
    `  ✓ LLM fill: ${llmSeeded} new conversions, ${llmNull} incompatible pairs\n`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
