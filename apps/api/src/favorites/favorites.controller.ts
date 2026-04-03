import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  getFavorites(@CurrentUser() user: User) {
    return this.favorites.getFavorites(user.id);
  }

  @Post(':recipeId')
  addFavorite(@Param('recipeId') recipeId: string, @CurrentUser() user: User) {
    return this.favorites.addFavorite(user.id, recipeId);
  }

  @Delete(':recipeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFavorite(@Param('recipeId') recipeId: string, @CurrentUser() user: User) {
    return this.favorites.removeFavorite(user.id, recipeId);
  }
}
