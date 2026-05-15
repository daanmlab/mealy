/**
 * Maintenance script — run with:
 *   cd apps/api && npx ts-node prisma/backfill-images.ts
 *
 * 1. Deletes all recipes with no sourceUrl (can't re-fetch their image)
 * 2. For every remaining recipe with imageUrl = null, fetches the source page,
 *    extracts og:image or JSON-LD image, and saves it to the DB.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

function extractImage(html: string): string | null {
  // 1. og:image meta tag
  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og?.[1]) return og[1];

  // 2. JSON-LD Recipe image field
  const ldBlocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const block of ldBlocks) {
    try {
      const data = JSON.parse(block[1] ?? '') as Record<string, unknown>;
      const recipes: Record<string, unknown>[] = Array.isArray(data['@graph'])
        ? (data['@graph'] as Record<string, unknown>[])
        : [data];

      for (const obj of recipes) {
        const type = obj['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (!types.some((t) => String(t).toLowerCase() === 'recipe')) continue;

        const img = obj['image'];
        if (typeof img === 'string') return img;
        if (Array.isArray(img) && img.length > 0) {
          const first = img[0];
          return typeof first === 'string'
            ? first
            : ((first as Record<string, string>)['url'] ?? null);
        }
        if (img && typeof img === 'object') {
          return (img as Record<string, string>)['url'] ?? null;
        }
      }
    } catch {
      // malformed JSON-LD block, skip
    }
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MealyBot/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`  ⚠ HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  ⚠ Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main() {
  // ── Step 1: delete recipes with no sourceUrl ──────────────────────────────
  const orphans = await prisma.recipe.findMany({
    where: { sourceUrl: null },
    select: { id: true, title: true },
  });

  if (orphans.length === 0) {
    console.log('✓ No orphan recipes (no sourceUrl) found.');
  } else {
    console.log(`\nDeleting ${orphans.length} recipe(s) with no sourceUrl…`);
    for (const r of orphans) {
      await prisma.recipe.delete({ where: { id: r.id } });
      console.log(`  ✓ Deleted: ${r.title}`);
    }
  }

  // ── Step 2: backfill imageUrl for recipes that are missing it ─────────────
  const missing = await prisma.recipe.findMany({
    where: { imageUrl: null, sourceUrl: { not: null } },
    select: { id: true, title: true, sourceUrl: true },
  });

  if (missing.length === 0) {
    console.log('\n✓ All recipes already have an imageUrl.');
    return;
  }

  console.log(`\nBackfilling images for ${missing.length} recipe(s)…`);

  let updated = 0;
  let skipped = 0;

  for (const recipe of missing) {
    process.stdout.write(`  → ${recipe.title} … `);
    const html = await fetchHtml(recipe.sourceUrl!);
    if (!html) {
      skipped++;
      process.stdout.write('skipped\n');
      continue;
    }

    const imageUrl = extractImage(html);
    if (!imageUrl) {
      skipped++;
      process.stdout.write('no image found\n');
      continue;
    }

    await prisma.recipe.update({ where: { id: recipe.id }, data: { imageUrl } });
    updated++;
    process.stdout.write('✓\n');
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
