import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
    private readonly catalog: CatalogService,
  ) {}

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
