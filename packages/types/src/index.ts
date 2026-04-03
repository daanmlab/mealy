// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Enums / primitives ───────────────────────────────────────────────────────

export type FoodGoal = 'easy' | 'healthy' | 'cheap' | 'high_protein';
export type CookTimePreference = 'under20' | 'under40' | 'any';
export type PlanStatus = 'draft' | 'confirmed';
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type RecipeTag =
  | 'pasta'
  | 'rice'
  | 'bowl'
  | 'stir_fry'
  | 'salad'
  | 'soup'
  | 'sheet_pan'
  | 'quick'
  | 'healthy'
  | 'cheap'
  | 'high_protein'
  | 'vegetarian'
  | 'vegan';

export type IngredientCategory =
  | 'produce'
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'grains'
  | 'canned'
  | 'condiments'
  | 'spices'
  | 'frozen'
  | 'other';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  peopleCount: number;
  mealsPerWeek: number;
  cookTime: CookTimePreference;
  goal: FoodGoal;
  dislikes: string[];
  onboardingDone: boolean;
}

export interface UpdatePreferences {
  peopleCount?: number;
  mealsPerWeek?: number;
  cookTime?: CookTimePreference;
  goal?: FoodGoal;
  dislikes?: string[];
  onboardingDone?: boolean;
}

// ─── Recipe ───────────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
}

export interface RecipeIngredient {
  id: string;
  amount: number;
  unit: string;
  ingredient: Ingredient;
}

export interface RecipeStep {
  order: number;
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  cookTimeMinutes: number;
  servings: number;
  imageUrl: string | null;
  tags: RecipeTag[];
  steps: RecipeStep[];
  ingredients: RecipeIngredient[];
}

// ─── Weekly Plan ──────────────────────────────────────────────────────────────

export interface PlanMeal {
  id: string;
  day: DayOfWeek;
  isLocked: boolean;
  recipe: Recipe;
}

export interface Plan {
  id: string;
  weekStartDate: string;
  status: PlanStatus;
  meals: PlanMeal[];
}

// ─── Grocery List ─────────────────────────────────────────────────────────────

export interface GroceryItem {
  id: string;
  totalAmount: number;
  unit: string;
  isChecked: boolean;
  ingredient: Ingredient;
}

export interface GroceryList {
  id: string;
  weeklyPlanId: string;
  generatedAt: string;
  items: GroceryItem[];
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export interface FavoriteRecipe {
  recipeId: string;
  savedAt: string;
  recipe: Recipe;
}
