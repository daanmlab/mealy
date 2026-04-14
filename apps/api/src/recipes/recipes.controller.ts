import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto, RecipeQueryDto } from './recipes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: RecipeQueryDto) {
    return this.recipesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.recipesService.findById(id);
  }

  @Post()
  @UseGuards(ApiKeyGuard)
  create(@Body() dto: CreateRecipeDto) {
    const { force, ...recipeDto } = dto;
    void force;
    return this.recipesService.create(recipeDto, true, false);
  }
}
