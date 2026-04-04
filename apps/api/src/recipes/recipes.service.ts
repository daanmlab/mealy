import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeTag } from '@prisma/client';
import { RecipeQueryDto } from './recipes.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    ingredients: {
      include: { ingredient: true },
    },
  };

  async findAll(query: RecipeQueryDto) {
    return this.prisma.recipe.findMany({
      where: {
        isActive: true,
        ...(query.maxCookTime && {
          cookTimeMinutes: { lte: query.maxCookTime },
        }),
        ...(query.tags?.length && { tags: { hasSome: query.tags } }),
      },
      include: this.include,
      take: query.limit ?? 50,
      orderBy: { title: 'asc' },
    });
  }

  async findById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: this.include,
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return recipe;
  }

  async findByTags(tags: RecipeTag[], excludeIds: string[] = [], limit = 20) {
    return this.prisma.recipe.findMany({
      where: {
        isActive: true,
        tags: { hasSome: tags },
        id: { notIn: excludeIds },
      },
      include: this.include,
      take: limit,
    });
  }

  async findSuggestions(
    excludeIds: string[] = [],
    tags: RecipeTag[] = [],
    limit = 10,
  ) {
    return this.prisma.recipe.findMany({
      where: {
        isActive: true,
        id: { notIn: excludeIds },
        ...(tags.length && { tags: { hasSome: tags } }),
      },
      include: this.include,
      take: limit,
      orderBy: { id: 'asc' },
    });
  }
}
