import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async getFavorites(userId: string) {
    return this.prisma.favoriteRecipe.findMany({
      where: { userId },
      include: {
        recipe: { include: { ingredients: { include: { ingredient: true } } } },
      },
      orderBy: { savedAt: 'desc' },
    });
  }

  async addFavorite(userId: string, recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    return this.prisma.favoriteRecipe.upsert({
      where: { userId_recipeId: { userId, recipeId } },
      create: { userId, recipeId },
      update: {},
      include: { recipe: true },
    });
  }

  async removeFavorite(userId: string, recipeId: string) {
    await this.prisma.favoriteRecipe.deleteMany({
      where: { userId, recipeId },
    });
  }

  async isFavorite(userId: string, recipeId: string): Promise<boolean> {
    const fav = await this.prisma.favoriteRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId } },
    });
    return !!fav;
  }
}
