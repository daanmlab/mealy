import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { RecipesService } from '../recipes/recipes.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateRecipeDto } from '../recipes/recipes.dto';
import { UpdateRecipeFullDto } from './admin.dto';
import {
  fetchPage,
  extractFromJsonLd,
  extractWithLlm,
  normalize,
  verifyAndFix,
  groupIngredients,
  canonicalizeIngredients,
} from '@mealy/scraper';

export type ImportStepName =
  | 'fetch'
  | 'extract'
  | 'verify'
  | 'group'
  | 'normalize'
  | 'canonicalize'
  | 'save';

export type ImportStepStatus = 'running' | 'done' | 'skipped' | 'error';

export interface ImportStepEvent {
  step: ImportStepName;
  status: ImportStepStatus;
  message: string;
  recipe?: { id: string; title: string };
}

export interface ImportJobEvent extends ImportStepEvent {
  jobId: string;
  url: string;
}

type Emit = (event: ImportStepEvent) => void;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly jobSubjects = new Map<
    string,
    ReplaySubject<ImportJobEvent>
  >();
  private readonly openai: OpenAI | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
    private readonly catalog: CatalogService,
  ) {
    const apiKey = process.env['OPENAI_API_KEY'];
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  getJobStream(jobId: string): Observable<ImportJobEvent> {
    const subject = this.jobSubjects.get(jobId);
    if (!subject) throw new NotFoundException(`Import job ${jobId} not found`);
    return subject.asObservable();
  }

  startImportJob(url: string): { jobId: string; url: string } {
    const jobId = randomUUID();
    // ReplaySubject buffers ALL events — late SSE subscribers still get the full history
    const subject = new ReplaySubject<ImportJobEvent>();
    this.jobSubjects.set(jobId, subject);

    setImmediate(() => {
      this.runImportPipeline(url, (event) => {
        subject.next({ ...event, jobId, url });
      })
        .then(() => subject.complete())
        .catch((err: Error) => {
          subject.next({
            jobId,
            url,
            step: 'save',
            status: 'error',
            message: err.message,
          });
          subject.complete();
        })
        .finally(() => {
          // Clean up after 10 minutes to avoid memory leaks
          setTimeout(() => this.jobSubjects.delete(jobId), 10 * 60 * 1000);
        });
    });

    return { jobId, url };
  }

  async listRecipes(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.recipe.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          cookTimeMinutes: true,
          isActive: true,
          createdAt: true,
          tags: { include: { tag: true } },
          _count: { select: { ingredients: true } },
        },
      }),
      this.prisma.recipe.count(),
    ]);
    return { items, total, page, limit };
  }

  async listUnits() {
    return this.prisma.unit.findMany({
      select: { id: true, symbol: true, name: true, type: true },
      orderBy: { symbol: 'asc' },
    });
  }

  async listIngredientCategories() {
    return this.prisma.ingredientCategory.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async listTags() {
    return this.prisma.tag.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async suggestTags(recipeId: string): Promise<string[]> {
    if (!this.openai) return [];

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        title: true,
        description: true,
        ingredients: { select: { ingredient: { select: { name: true } } } },
      },
    });
    if (!recipe) throw new NotFoundException(`Recipe ${recipeId} not found`);

    const allTags = await this.prisma.tag.findMany({
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    });

    const ingredientNames = recipe.ingredients
      .map((ri) => ri.ingredient.name)
      .join(', ');

    const prompt = `You are a recipe tagging assistant. Given the recipe below, select the most relevant tags from the provided list.

Recipe title: ${recipe.title}
Description: ${recipe.description ?? 'N/A'}
Ingredients: ${ingredientNames || 'N/A'}

Available tags (slug: display name):
${allTags.map((t) => `- ${t.slug}: ${t.name}`).join('\n')}

Return a JSON object: { "slugs": ["slug1", "slug2", ...] }
Only include tags that genuinely apply. Return 2–6 tags maximum.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });
      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as { slugs?: unknown };
      const validSlugs = new Set(allTags.map((t) => t.slug));
      return Array.isArray(parsed.slugs)
        ? (parsed.slugs as unknown[]).filter(
            (s): s is string => typeof s === 'string' && validSlugs.has(s),
          )
        : [];
    } catch (err) {
      this.logger.warn(
        `Tag suggestion failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error('AI tag suggestion failed — please try again');
    }
  }

  async searchIngredients(q: string, limit = 20) {
    const normalized = q.toLowerCase().trim();
    if (!normalized) {
      return this.prisma.ingredient.findMany({
        take: limit,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, category: true },
      });
    }

    // Search both canonical names and aliases, return unique ingredients
    const [byName, byAlias] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { name: { contains: normalized, mode: 'insensitive' } },
        take: limit,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, category: true },
      }),
      this.prisma.ingredientAlias.findMany({
        where: { alias: { contains: normalized, mode: 'insensitive' } },
        take: limit,
        include: {
          ingredient: { select: { id: true, name: true, category: true } },
        },
      }),
    ]);

    const seen = new Set<string>();
    const results: {
      id: string;
      name: string;
      category: { id: string; name: string; slug: string } | null;
    }[] = [];

    for (const ing of byName) {
      if (!seen.has(ing.id)) {
        seen.add(ing.id);
        results.push(ing);
      }
    }
    for (const alias of byAlias) {
      if (!seen.has(alias.ingredient.id)) {
        seen.add(alias.ingredient.id);
        results.push(alias.ingredient);
      }
    }

    return results.slice(0, limit);
  }

  async updateRecipe(id: string, data: UpdateRecipeFullDto, actorId: string) {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Recipe ${id} not found`);

    const UNIT_FALLBACK = 'unit';

    const {
      isActive,
      title,
      description,
      cookTimeMinutes,
      servings,
      sourceUrl,
      steps,
      tagSlugs,
      ingredients,
    } = data;

    // If ingredients provided, resolve them outside the transaction (same as RecipesService.create)
    let resolvedIngredients:
      | {
          ingredientId: string;
          amount: number;
          unitSymbol: string;
          categorySlug: string;
          groupName?: string;
        }[]
      | undefined;

    if (ingredients !== undefined) {
      resolvedIngredients = await Promise.all(
        ingredients.map(async (ing) => {
          let ingredientId: string;
          if (ing.ingredientId) {
            const found = await this.prisma.ingredient.findUnique({
              where: { id: ing.ingredientId },
            });
            if (!found)
              throw new BadRequestException(
                `Ingredient ${ing.ingredientId} not found`,
              );
            ingredientId = found.id;
          } else {
            const resolved = await this.catalog.resolveIngredient(ing.name);
            ingredientId = resolved.id;
          }

          let unitSymbol = ing.unitSymbol;
          let amount = ing.amount;
          if (unitSymbol === UNIT_FALLBACK || !unitSymbol) {
            const inferred = await this.catalog.inferUnit(
              ing.name,
              ing.amount,
              existing.title,
            );
            if (inferred) {
              unitSymbol = inferred.unitSymbol;
              amount = inferred.amount;
            } else {
              unitSymbol = UNIT_FALLBACK;
            }
          }

          return {
            ingredientId,
            amount,
            unitSymbol,
            categorySlug: ing.categorySlug,
            groupName: ing.groupName,
          };
        }),
      );
    }

    const recipe = await this.prisma.$transaction(async (tx) => {
      // 1. Update scalar fields and steps
      await tx.recipe.update({
        where: { id },
        data: {
          ...(isActive !== undefined && { isActive }),
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(cookTimeMinutes !== undefined && { cookTimeMinutes }),
          ...(servings !== undefined && { servings }),
          ...(sourceUrl !== undefined && { sourceUrl }),
          ...(steps !== undefined && {
            steps: steps as unknown as Prisma.InputJsonValue,
          }),
        },
      });

      // 2. Replace tags
      if (tagSlugs !== undefined) {
        await tx.recipeTag.deleteMany({ where: { recipeId: id } });
        const uniqueTagSlugs = [...new Set(tagSlugs)];
        const tagRecords = await Promise.all(
          uniqueTagSlugs.map((slug) =>
            tx.tag.upsert({
              where: { slug },
              create: { slug, name: slug.replace(/_/g, ' ') },
              update: {},
            }),
          ),
        );
        await tx.recipeTag.createMany({
          data: tagRecords.map((t) => ({ recipeId: id, tagId: t.id })),
        });
      }

      // 3. Replace ingredients (full delete + recreate)
      if (resolvedIngredients !== undefined) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        await tx.ingredientGroup.deleteMany({ where: { recipeId: id } });

        // Upsert units
        const uniqueUnitSymbols = [
          ...new Set(
            resolvedIngredients
              .map((i) => i.unitSymbol)
              .filter((s) => s !== UNIT_FALLBACK),
          ),
        ];
        const unitRecords = await Promise.all(
          uniqueUnitSymbols.map((symbol) =>
            tx.unit.upsert({
              where: { symbol },
              create: { symbol, name: symbol, type: 'other' },
              update: {},
            }),
          ),
        );
        const unitBySymbol = Object.fromEntries(
          unitRecords.map((u, i) => [uniqueUnitSymbols[i], u]),
        );

        // Upsert categories
        const uniqueCategorySlugs = [
          ...new Set(
            resolvedIngredients.map((i) => i.categorySlug).filter(Boolean),
          ),
        ];
        const categoryRecords = await Promise.all(
          uniqueCategorySlugs.map((slug) =>
            tx.ingredientCategory.upsert({
              where: { slug },
              create: {
                slug,
                name:
                  slug.charAt(0).toUpperCase() +
                  slug.slice(1).replace(/_/g, ' '),
              },
              update: {},
            }),
          ),
        );
        const categoryBySlug = Object.fromEntries(
          categoryRecords.map((c, i) => [uniqueCategorySlugs[i], c]),
        );

        // Deduplicate by (ingredientId, groupName)
        const deduped = new Map<
          string,
          {
            ingredientId: string;
            amount: number;
            unitSymbol: string;
            categorySlug: string;
            groupName?: string;
          }
        >();
        for (const ing of resolvedIngredients) {
          const key = `${ing.ingredientId}::${ing.groupName ?? ''}`;
          const existing = deduped.get(key);
          if (existing) {
            existing.amount += ing.amount;
          } else {
            deduped.set(key, { ...ing });
          }
        }
        const uniqueIngredients = [...deduped.values()];

        // Update categoryId on canonical ingredient rows
        await Promise.all(
          uniqueIngredients
            .filter((ing) => ing.categorySlug)
            .map((ing) => {
              const categoryId = categoryBySlug[ing.categorySlug]?.id;
              if (!categoryId) return Promise.resolve();
              return tx.ingredient.update({
                where: { id: ing.ingredientId },
                data: { categoryId },
              });
            }),
        );

        // Create ingredient groups
        const groupNames = [
          ...new Set(
            uniqueIngredients
              .map((i) => i.groupName)
              .filter((g): g is string => !!g),
          ),
        ];
        const groupRecords = await Promise.all(
          groupNames.map((name, idx) =>
            tx.ingredientGroup.create({
              data: { recipeId: id, name, sortOrder: idx },
            }),
          ),
        );
        const groupByName = Object.fromEntries(
          groupRecords.map((g) => [g.name, g]),
        );

        await tx.recipeIngredient.createMany({
          data: uniqueIngredients.map((ing) => ({
            recipeId: id,
            ingredientId: ing.ingredientId,
            unitId: unitBySymbol[ing.unitSymbol]?.id ?? null,
            groupId: ing.groupName
              ? (groupByName[ing.groupName]?.id ?? null)
              : null,
            amount: ing.amount,
          })),
        });
      }

      return tx.recipe.findUniqueOrThrow({
        where: { id },
        include: {
          groups: { orderBy: { sortOrder: 'asc' } },
          tags: { include: { tag: true } },
          ingredients: {
            include: {
              ingredient: { include: { category: true } },
              unit: true,
              group: true,
            },
            orderBy: { ingredient: { name: 'asc' } },
          },
        },
      });
    });

    await this.writeAuditLog('recipe.update', 'recipe', id, actorId, {
      title: recipe.title,
      fields: Object.keys(data),
    });

    return recipe;
  }

  async deleteRecipe(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Recipe ${id} not found`);
    await this.prisma.recipe.delete({ where: { id } });
    await this.writeAuditLog('recipe.delete', 'recipe', id, actorId, {
      title: existing.title,
    });
  }

  async createRecipe(dto: CreateRecipeDto, actorId: string) {
    const recipe = await this.recipes.create(dto, false);
    await this.writeAuditLog('recipe.create', 'recipe', recipe.id, actorId, {
      title: recipe.title,
    });
    return recipe;
  }

  async renameTag(id: string, name: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    return this.prisma.tag.update({ where: { id }, data: { name } });
  }

  async deleteTag(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { recipes: true } } },
    });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    if (tag._count.recipes > 0) {
      throw new BadRequestException(
        `Tag is used by ${tag._count.recipes} recipe(s) and cannot be deleted`,
      );
    }
    await this.prisma.tag.delete({ where: { id } });
  }

  async listAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, limit };
  }

  private async writeAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    actorId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          actorId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async runImportPipeline(url: string, emit: Emit) {
    this.logger.log(`Importing recipe from URL: ${url}`);

    emit({ step: 'fetch', status: 'running', message: `Fetching ${url}…` });
    let html: string;
    try {
      html = await fetchPage(url);
      emit({ step: 'fetch', status: 'done', message: 'Page fetched' });
    } catch (err) {
      emit({
        step: 'fetch',
        status: 'error',
        message: `Failed to fetch: ${err instanceof Error ? err.message : String(err)}`,
      });
      throw new BadRequestException(
        `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    emit({
      step: 'extract',
      status: 'running',
      message: 'Extracting recipe data (JSON-LD)…',
    });
    let raw = extractFromJsonLd(html);
    if (raw) {
      this.logger.log('Extracted via JSON-LD');
      emit({
        step: 'extract',
        status: 'done',
        message: 'Extracted via JSON-LD',
      });
    } else {
      emit({
        step: 'extract',
        status: 'running',
        message: 'JSON-LD not found — trying LLM extraction…',
      });
      raw = await extractWithLlm(html);
      if (raw) {
        emit({ step: 'extract', status: 'done', message: 'Extracted via LLM' });
      } else {
        emit({
          step: 'extract',
          status: 'error',
          message: 'Could not extract recipe from URL',
        });
        throw new BadRequestException(
          'Could not extract recipe from the provided URL',
        );
      }
    }

    raw.sourceUrl = url;

    if (process.env['OPENAI_API_KEY']) {
      emit({
        step: 'verify',
        status: 'running',
        message: 'Verifying recipe quality…',
      });
      const { recipe: fixed, wasFixed, issues } = await verifyAndFix(raw);
      raw = fixed;
      emit({
        step: 'verify',
        status: 'done',
        message: wasFixed
          ? `Fixed ${issues.length} issue(s)`
          : 'No issues found',
      });

      emit({
        step: 'group',
        status: 'running',
        message: 'Grouping ingredients…',
      });
      const groupMap = await groupIngredients(raw.ingredients, raw.steps);
      if (groupMap.size > 0) {
        raw.ingredients = raw.ingredients.map((ing) => ({
          ...ing,
          groupName: groupMap.get(ing.name) ?? ing.groupName,
        }));
      }
      emit({
        step: 'group',
        status: 'done',
        message: `${groupMap.size} group(s) identified`,
      });
    } else {
      emit({
        step: 'verify',
        status: 'skipped',
        message: 'Skipped (no OPENAI_API_KEY)',
      });
      emit({
        step: 'group',
        status: 'skipped',
        message: 'Skipped (no OPENAI_API_KEY)',
      });
    }

    emit({
      step: 'normalize',
      status: 'running',
      message: 'Normalizing recipe…',
    });
    const normalized = normalize(raw);
    emit({ step: 'normalize', status: 'done', message: 'Recipe normalized' });

    if (process.env['OPENAI_API_KEY']) {
      emit({
        step: 'canonicalize',
        status: 'running',
        message: 'Canonicalizing ingredients against catalog…',
      });
      try {
        const dbCatalog = await this.catalog.getCatalog();
        const canonical = await canonicalizeIngredients(
          normalized.ingredients,
          dbCatalog.units,
          dbCatalog.ingredients,
        );
        normalized.ingredients = canonical;
        emit({
          step: 'canonicalize',
          status: 'done',
          message: 'Ingredients canonicalized',
        });
      } catch (err) {
        this.logger.warn(
          `Canonicalization skipped: ${err instanceof Error ? err.message : err}`,
        );
        emit({
          step: 'canonicalize',
          status: 'skipped',
          message: 'Skipped (canonicalization error)',
        });
      }
    } else {
      emit({
        step: 'canonicalize',
        status: 'skipped',
        message: 'Skipped (no OPENAI_API_KEY)',
      });
    }

    emit({ step: 'save', status: 'running', message: 'Saving recipe…' });
    const recipe = await this.recipes.create(
      normalized as CreateRecipeDto,
      false,
    );
    emit({
      step: 'save',
      status: 'done',
      message: `"${recipe.title}" saved`,
      recipe: { id: recipe.id, title: recipe.title },
    });

    return recipe;
  }
}
