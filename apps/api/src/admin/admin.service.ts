import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RecipesService } from '../recipes/recipes.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateRecipeDto } from '../recipes/recipes.dto';
import { UpdateRecipeDto } from './admin.dto';
import {
  fetchPage,
  extractFromJsonLd,
  extractWithLlm,
  normalize,
  verifyAndFix,
  groupIngredients,
  canonicalizeIngredients,
} from '@mealy/scraper';
import {
  ImportJobSnapshot,
  ImportStepName,
  ImportStepStatus,
} from '@mealy/types';

export type { ImportStepName, ImportStepStatus };

export interface ImportStepEvent {
  step: ImportStepName;
  status: ImportStepStatus;
  message: string;
  recipe?: { id: string; title: string };
}

export interface ImportSubStepEvent {
  step: ImportStepName;
  subStep: string;
  status: 'running' | 'done' | 'skipped';
  message?: string;
}

type EmitEvent = ImportStepEvent | ImportSubStepEvent;
type Emit = (event: EmitEvent) => void;

const ALL_STEPS: ImportStepName[] = [
  'fetch',
  'extract',
  'verify',
  'group',
  'normalize',
  'canonicalize',
  'save',
];

const STEP_SUBSTEPS: Partial<Record<ImportStepName, string[]>> = {
  fetch: ['request', 'capture', 'browser'],
  extract: ['jsonld', 'prepare', 'llm'],
  verify: ['analyze', 'fix'],
  group: ['analyze', 'assign'],
  canonicalize: ['catalog', 'match'],
  save: ['write'],
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly jobSnapshots = new Map<string, ImportJobSnapshot>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
    private readonly catalog: CatalogService,
    @InjectQueue('import') private readonly importQueue: Queue,
  ) {}

  getJobSnapshot(jobId: string): ImportJobSnapshot {
    const snapshot = this.jobSnapshots.get(jobId);
    if (!snapshot) throw new NotFoundException(`Import job ${jobId} not found`);
    return snapshot;
  }

  updateJobSnapshot(
    jobId: string,
    fn: (s: ImportJobSnapshot) => ImportJobSnapshot,
  ): void {
    const snapshot = this.jobSnapshots.get(jobId);
    if (snapshot) this.jobSnapshots.set(jobId, fn(snapshot));
  }

  cleanupSnapshot(jobId: string): void {
    this.jobSnapshots.delete(jobId);
  }

  async startImportJob(url: string): Promise<{ jobId: string; url: string }> {
    const jobId = randomUUID();
    this.jobSnapshots.set(jobId, {
      jobId,
      url,
      steps: ALL_STEPS.map((step) => ({
        step,
        status: 'pending',
        message: '',
        subSteps: (STEP_SUBSTEPS[step] ?? []).map((name) => ({
          name,
          status: 'pending',
          message: '',
        })),
      })),
      jobStatus: 'queued',
    });

    await this.importQueue.add('scrape', { jobId, url });

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

  async updateRecipe(id: string, data: UpdateRecipeDto) {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Recipe ${id} not found`);

    const {
      isActive,
      title,
      description,
      cookTimeMinutes,
      servings,
      imageUrl,
      sourceUrl,
    } = data;
    return this.prisma.recipe.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(cookTimeMinutes !== undefined && { cookTimeMinutes }),
        ...(servings !== undefined && { servings }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(sourceUrl !== undefined && { sourceUrl }),
      },
      select: {
        id: true,
        title: true,
        cookTimeMinutes: true,
        isActive: true,
        createdAt: true,
        tags: { include: { tag: true } },
        _count: { select: { ingredients: true } },
      },
    });
  }

  async deleteRecipe(id: string): Promise<void> {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Recipe ${id} not found`);
    await this.prisma.recipe.delete({ where: { id } });
  }

  async createRecipe(dto: CreateRecipeDto) {
    return this.recipes.create(dto, false);
  }

  async executePipeline(url: string, emit: Emit) {
    this.logger.log(`Importing recipe from URL: ${url}`);

    // Helper to emit a sub-step event
    const sub = (
      step: ImportStepName,
      subStep: string,
      status: 'running' | 'done' | 'skipped',
      message?: string,
    ) => emit({ step, subStep, status, message });

    emit({ step: 'fetch', status: 'running', message: `Fetching ${url}…` });
    let html: string;
    try {
      html = await fetchPage(url, {
        onProgress: (s, status, message) => sub('fetch', s, status, message),
      });
      emit({ step: 'fetch', status: 'done', message: 'Page fetched' });
    } catch (err) {
      throw new BadRequestException(
        `Failed to fetch: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    emit({
      step: 'extract',
      status: 'running',
      message: 'Extracting recipe data…',
    });
    sub('extract', 'jsonld', 'running', 'Checking for JSON-LD…');
    let raw = extractFromJsonLd(html);
    if (raw) {
      this.logger.log('Extracted via JSON-LD');
      sub('extract', 'jsonld', 'done', 'Found JSON-LD');
      sub('extract', 'prepare', 'skipped');
      sub('extract', 'llm', 'skipped');
      emit({
        step: 'extract',
        status: 'done',
        message: 'Extracted via JSON-LD',
      });
    } else {
      sub('extract', 'jsonld', 'done', 'No JSON-LD found');
      raw = await extractWithLlm(html, (s, status) =>
        sub('extract', s, status),
      );
      if (raw) {
        emit({ step: 'extract', status: 'done', message: 'Extracted via LLM' });
      } else {
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
      const {
        recipe: fixed,
        wasFixed,
        issues,
      } = await verifyAndFix(raw, {
        onProgress: (s, status) => sub('verify', s, status),
      });
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
      const groupMap = await groupIngredients(raw.ingredients, raw.steps, {
        onProgress: (s, status) => sub('group', s, status),
      });
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
        message: 'Canonicalizing ingredients…',
      });
      // Non-blocking: canonicalization failures emit 'skipped' rather than 'error' so the import still completes.
      try {
        sub('canonicalize', 'catalog', 'running', 'Loading catalog…');
        const dbCatalog = await this.catalog.getCatalog();
        sub('canonicalize', 'catalog', 'done', 'Catalog loaded');
        const canonical = await canonicalizeIngredients(
          normalized.ingredients,
          dbCatalog.units,
          dbCatalog.ingredients,
          { onProgress: (s, status) => sub('canonicalize', s, status) },
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
    sub('save', 'write', 'running', 'Writing to database…');
    const recipe = await this.recipes.create(
      normalized as CreateRecipeDto,
      false,
    );
    sub('save', 'write', 'done', 'Written');
    emit({
      step: 'save',
      status: 'done',
      message: `"${recipe.title}" saved`,
      recipe: { id: recipe.id, title: recipe.title },
    });

    return recipe;
  }
}
