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

// ─── Lookup catalogue types ───────────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface IngredientCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Unit {
  id: string;
  symbol: string;
  name: string;
  type: 'weight' | 'volume' | 'count' | 'other';
}

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
  category: IngredientCategory | null;
}

export interface IngredientGroup {
  id: string;
  name: string;
  sortOrder: number;
}

export interface RecipeIngredient {
  id: string;
  amount: number;
  unit: Unit;
  group: IngredientGroup | null;
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
  sourceUrl: string | null;
  steps: RecipeStep[];
  tags: { tag: Tag }[];
  groups: IngredientGroup[];
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

export interface GroceryItemSource {
  id: string;
  recipeId: string;
  day: DayOfWeek;
  amount: number;
  unit: Unit | null;
  recipe: { id: string; title: string };
}

export interface GroceryItem {
  id: string;
  totalAmount: number;
  unit: Unit;
  isChecked: boolean;
  ingredient: Ingredient;
  sources: GroceryItemSource[];
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
