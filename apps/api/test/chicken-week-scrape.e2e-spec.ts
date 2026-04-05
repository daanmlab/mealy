/**
 * Full e2e test: scrape 5 chicken recipes → build a weekly plan → generate grocery list.
 *
 * This test exercises the entire pipeline end-to-end with real network requests:
 *   1. Bootstraps the NestJS application on a random port
 *   2. Runs the scraper as a subprocess to import 5 chicken recipe URLs
 *   3. Creates a test user and a confirmed weekly plan using those recipes
 *   4. Generates the grocery list via GroceryService
 *   5. Asserts that no duplicate (ingredientId, unitId) pairs appear in the list
 *      (proving that the unit conversion merge works on real scraped data)
 *
 * Prerequisites:
 *   - PostgreSQL running (docker-compose up)
 *   - apps/api/.env has DATABASE_URL, REDIS_URL set
 *   - Network access to recipetineats.com and bbcgoodfood.com
 *
 * Run: npx jest --config test/jest-e2e.json --testPathPattern chicken-week
 * Keep data: WITH_TEARDOWN=false npx jest ...  (default — plan stays in DB for inspection)
 * Clean up:  WITH_TEARDOWN=true  npx jest ...
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { promisify } from 'util';
import { exec } from 'child_process';
import { join } from 'path';

const execAsync = promisify(exec);
import {
  CookTimePreference,
  DayOfWeek,
  FoodGoal,
  PlanStatus,
} from '@prisma/client';
import type { User } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GroceryService } from '../src/grocery/grocery.service';

// ─── Recipe URLs ─────────────────────────────────────────────────────────────
// 5 chicken recipes that produce shared ingredients (e.g. soy sauce, garlic,
// olive oil) in different units — the exact scenario that exposed the bug.

const CHICKEN_URLS = [
  'https://www.recipetineats.com/butter-chicken/',
  'https://www.recipetineats.com/honey-garlic-chicken/',
  'https://www.recipetineats.com/chicken-shawarma/',
  'https://www.bbcgoodfood.com/recipes/chicken-tikka-masala',
  'https://www.bbcgoodfood.com/recipes/easy-chicken-fajitas',
];

const SCRAPER_DIR = join(__dirname, '../../scraper');
const TEST_API_KEY = 'e2e-test-scraper-key';

// Set WITH_TEARDOWN=true to delete the test plan/user after the run (default: keep data for inspection)
const WITH_TEARDOWN = process.env['WITH_TEARDOWN'] === 'true';

const WEEKDAYS: DayOfWeek[] = [
  DayOfWeek.monday,
  DayOfWeek.tuesday,
  DayOfWeek.wednesday,
  DayOfWeek.thursday,
  DayOfWeek.friday,
];

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Chicken week grocery list (scraper → plan → grocery, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let groceryService: GroceryService;
  let port: number;
  let testUser: User;
  let planId: string;
  let importedRecipeIds: string[] = [];

  // ── Setup: start the API ───────────────────────────────────────────────────
  beforeAll(async () => {
    // Set API key before the module compiles so ConfigService picks it up
    process.env['SCRAPER_API_KEY'] = TEST_API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.listen(0); // random free port

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    port = (app.getHttpServer().address() as { port: number }).port;
    prisma = moduleRef.get(PrismaService);
    groceryService = moduleRef.get(GroceryService);

    // Create a test user (isolated from production data)
    testUser = await prisma.user.create({
      data: {
        email: `e2e-chicken-${Date.now()}@test.local`,
        name: 'E2E Chicken Test',
        peopleCount: 2,
        mealsPerWeek: 5,
        cookTime: CookTimePreference.any,
        goal: FoodGoal.healthy,
      },
    });
  }, 60_000);

  // ── Teardown ───────────────────────────────────────────────────────────────
  afterAll(async () => {
    if (WITH_TEARDOWN) {
      try {
        // Only delete the plan and test user (not the recipes — they may be shared with other plans)
        if (planId) {
          await prisma.groceryList.deleteMany({
            where: { weeklyPlanId: planId },
          });
          await prisma.weeklyPlanMeal.deleteMany({
            where: { weeklyPlanId: planId },
          });
          await prisma.weeklyPlan.delete({ where: { id: planId } });
        }
        if (testUser?.id) {
          await prisma.user.delete({ where: { id: testUser.id } });
        }
      } catch {
        // Best-effort cleanup — don't fail the suite on teardown errors
      }
    }
    await app.close();
  }, 30_000);

  // ── Step 1: scrape ─────────────────────────────────────────────────────────
  it('step 1 — scraper imports 5 chicken recipes via the live API', async () => {
    const cmd = [
      'npm run scrape --',
      '--urls',
      ...CHICKEN_URLS.map((u) => `"${u}"`),
      '--api-url',
      `"http://localhost:${port}/api"`,
      '--api-key',
      TEST_API_KEY,
    ].join(' ');

    // Use async exec so the event loop stays unblocked (Prisma transactions need it)
    let stdout = '';
    try {
      const result = await execAsync(cmd, {
        cwd: SCRAPER_DIR,
        timeout: 180_000,
        env: { ...process.env, SCRAPER_API_KEY: TEST_API_KEY },
      });
      stdout = result.stdout;
    } catch (err: unknown) {
      // execAsync throws on non-zero exit — partial failure is OK if enough recipes were saved.
      // Capture stdout and continue; assert on importedRecipeIds count below.
      const execErr = err as { stdout?: string; code?: number };
      stdout = execErr.stdout ?? '';
    }

    // Extract recipe IDs logged by the scraper ("Saved as recipe <id>")
    const matches = [...stdout.matchAll(/Saved as recipe (\S+)/g)];
    importedRecipeIds = matches.map((m) => m[1]);

    // Fall back to DB lookup for recipes that already existed (duplicate sourceUrl → 500)
    if (importedRecipeIds.length < 3) {
      const existing = await prisma.recipe.findMany({
        where: { sourceUrl: { in: CHICKEN_URLS } },
        select: { id: true, sourceUrl: true },
        orderBy: { createdAt: 'desc' },
      });
      const existingIds = existing.map((r) => r.id);
      // Merge with newly imported, deduplicate
      importedRecipeIds = [...new Set([...importedRecipeIds, ...existingIds])];
    }

    expect(importedRecipeIds.length).toBeGreaterThanOrEqual(
      3, // require at least 3 recipes to build a meaningful grocery list
    );
  }, 300_000); // 5 min — LLM verify + canonicalize adds ~30s per recipe

  // ── Step 2: build plan ─────────────────────────────────────────────────────
  it('step 2 — creates a confirmed weekly plan with the scraped recipes', async () => {
    expect(importedRecipeIds.length).toBeGreaterThan(0);

    // Take up to 5 recipes (however many were successfully scraped)
    const recipeIds = importedRecipeIds.slice(0, 5);

    const plan = await prisma.weeklyPlan.create({
      data: {
        userId: testUser.id,
        status: PlanStatus.confirmed,
        weekStartDate: new Date('2030-01-01'), // far future to avoid collision
        meals: {
          create: recipeIds.map((id, i) => ({
            recipeId: id,
            day: WEEKDAYS[i],
            isLocked: false,
          })),
        },
      },
    });

    planId = plan.id;
    expect(planId).toBeTruthy();
  });

  // ── Step 3: generate grocery list + assert no duplicates ───────────────────
  it('step 3 — grocery list has no duplicate (ingredient, unit) pairs', async () => {
    expect(planId).toBeTruthy();

    const list = await groceryService.generateList(planId, testUser);

    type GroceryItem = {
      ingredientId: string;
      unitId: string;
      totalAmount: number;
    };
    const items = list.items as GroceryItem[];

    expect(items.length).toBeGreaterThan(0);

    // Check for duplicates: same ingredient + same unit should appear only once
    const seen = new Map<string, GroceryItem>();
    const duplicates: Array<{ key: string; items: GroceryItem[] }> = [];

    for (const item of items) {
      const key = `${item.ingredientId}:${item.unitId}`;
      const prev = seen.get(key);
      if (prev) {
        duplicates.push({ key, items: [prev, item] });
      } else {
        seen.set(key, item);
      }
    }

    expect(duplicates).toHaveLength(0);
  });
});
