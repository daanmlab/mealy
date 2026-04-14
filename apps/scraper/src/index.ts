import 'dotenv/config';
import { Command } from 'commander';
import { fetchPage } from './fetcher.js';
import { extractFromJsonLd } from './extractors/jsonld.js';
import { extractWithLlm } from './extractors/llm.js';
import { normalize } from './normalizer.js';
import { verifyAndFix, groupIngredients } from './verifier.js';
import { postRecipe, getCatalog, ScrapeResult } from './api-client.js';
import { canonicalizeIngredients } from './canonicalizer.js';
import { DEFAULT_URLS } from './default-urls.js';

const program = new Command();

program
  .name('scrape')
  .description('Scrape recipes from the web and import them into Mealy')
  .option(
    '--urls <urls...>',
    `One or more recipe page URLs to scrape (defaults to ${DEFAULT_URLS.length} built-in URLs)`,
  )
  .option('--dry-run', 'Print extracted data as JSON without posting to the API', false)
  .option(
    '--no-verify',
    'Skip AI quality verification (verification runs by default when OPENAI_API_KEY is set)',
  )
  .option(
    '--no-canonicalize',
    'Skip LLM ingredient/unit canonicalization against the DB (runs by default when OPENAI_API_KEY is set)',
  )
  .option(
    '--clean-model <model>',
    'Model used to fix issues found during verification',
    'gpt-4o-mini',
  )
  .option('--api-url <url>', 'Mealy API base URL', process.env.API_URL ?? 'http://localhost:3001')
  .option('--api-key <key>', 'Mealy API key (X-Api-Key)', process.env.SCRAPER_API_KEY ?? '');

async function scrapeUrl(
  url: string,
  dryRun: boolean,
  verify: boolean,
  canonicalize: boolean,
  cleanModel: string,
  apiUrl: string,
  apiKey: string,
): Promise<ScrapeResult> {
  console.log(`\n[scrape] → ${url}`);

  let html: string;
  try {
    html = await fetchPage(url);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed to fetch page: ${error}`);
    return { url, success: false, error };
  }

  // 1. Try JSON-LD extraction
  let raw = extractFromJsonLd(html);
  if (raw) {
    console.log('  ✓ Extracted via JSON-LD schema');
  } else {
    // 2. Fall back to LLM
    console.log('  ⚠ JSON-LD extraction failed, trying LLM…');
    raw = await extractWithLlm(html);
    if (raw) {
      console.log('  ✓ Extracted via LLM');
    }
  }

  if (!raw) {
    const error = 'Could not extract recipe from page';
    console.error(`  ✗ ${error}`);
    return { url, success: false, error };
  }

  // Attach the source URL
  raw.sourceUrl = url;

  // 3. Verify + fix (runs by default when OPENAI_API_KEY is set, skip with --no-verify)
  if (verify && process.env.OPENAI_API_KEY) {
    const { recipe: fixed, wasFixed, issues } = await verifyAndFix(raw, { cleanModel });
    if (issues.length === 0) {
      console.log('  ✓ Verified: looks good');
    } else if (wasFixed) {
      console.log(`  ⚠ Verified: ${issues.length} issue(s) found — fixed by ${cleanModel}`);
      issues.forEach((issue) => console.log(`    · ${issue}`));
    } else {
      console.log(`  ⚠ Verified: ${issues.length} issue(s) found (could not fix)`);
      issues.forEach((issue) => console.log(`    · ${issue}`));
    }
    raw = fixed;

    // 4. Identify ingredient groups from step context
    const groupMap = await groupIngredients(raw.ingredients, raw.steps, { model: cleanModel });
    if (groupMap.size > 0) {
      console.log(`  ✓ Grouped: ${groupMap.size} ingredient(s) assigned to named groups`);
      raw.ingredients = raw.ingredients.map((ing) => ({
        ...ing,
        groupName: groupMap.get(ing.name) ?? ing.groupName,
      }));
    }
  }

  // 5. Normalize
  const normalized = normalize(raw);
  console.log(
    `  ✓ Normalized: "${normalized.title}" (${normalized.ingredients.length} ingredients, ${normalized.steps.length} steps)`,
  );

  // 6. LLM canonicalization — remap ingredient names/units against the live DB inventory
  if (canonicalize && process.env.OPENAI_API_KEY && !dryRun) {
    try {
      const catalog = await getCatalog(apiUrl, apiKey);
      const canonical = await canonicalizeIngredients(
        normalized.ingredients,
        catalog.units,
        catalog.ingredients,
        { model: cleanModel },
      );
      const changed = canonical.filter(
        (ing, i) =>
          ing.name !== normalized.ingredients[i]?.name ||
          ing.unitSymbol !== normalized.ingredients[i]?.unitSymbol,
      ).length;
      if (changed > 0) {
        console.log(`  ✓ Canonicalized: ${changed} ingredient(s) remapped to known DB forms`);
      } else {
        console.log('  ✓ Canonicalized: all ingredients already match known DB forms');
      }
      normalized.ingredients = canonical;
    } catch (err) {
      console.warn('  ⚠ Canonicalization skipped:', err instanceof Error ? err.message : err);
    }
  }

  if (dryRun) {
    console.log('  [dry-run] Would POST:');
    console.log(JSON.stringify(normalized, null, 2));
    return { url, success: true, title: normalized.title };
  }

  // 7. POST to API
  try {
    const id = await postRecipe(normalized, apiUrl, apiKey);
    console.log(`  ✓ Saved as recipe ${id}`);
    return { url, success: true, recipeId: id, title: normalized.title };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ API error: ${error}`);
    return { url, success: false, title: normalized.title, error };
  }
}

async function main() {
  program.parse();
  const opts = program.opts<{
    urls?: string[];
    dryRun: boolean;
    verify: boolean;
    canonicalize: boolean;
    cleanModel: string;
    apiUrl: string;
    apiKey: string;
  }>();

  const urls = opts.urls ?? DEFAULT_URLS;

  if (!opts.dryRun && !opts.apiKey) {
    console.error(
      'Error: --api-key or SCRAPER_API_KEY env var is required when not using --dry-run',
    );
    process.exit(1);
  }

  console.log(`Scraping ${urls.length} URL(s)…`);

  const results: ScrapeResult[] = [];
  for (const url of urls) {
    const result = await scrapeUrl(
      url,
      opts.dryRun,
      opts.verify,
      opts.canonicalize,
      opts.cleanModel,
      opts.apiUrl,
      opts.apiKey,
    );
    results.push(result);
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n── Summary ──────────────────────────────────`);
  console.log(`  Processed : ${results.length}`);
  console.log(`  Succeeded : ${succeeded}`);
  console.log(`  Failed    : ${failed}`);

  if (failed > 0) {
    console.log('\nFailed URLs:');
    results.filter((r) => !r.success).forEach((r) => console.log(`  • ${r.url}\n    ${r.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
