// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
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
  isAdmin: boolean;
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
  isActive: boolean;
  imageUrl: string | null;
  sourceUrl: string | null;
  steps: RecipeStep[];
  tags: { tag: Tag }[];
  groups: IngredientGroup[];
  ingredients: RecipeIngredient[];
}

export interface AdminRecipeListItem {
  id: string;
  title: string;
  cookTimeMinutes: number;
  isActive: boolean;
  createdAt: string;
  tags: { tag: Tag }[];
  _count: { ingredients: number };
}

export interface ImportUrlDto {
  url: string;
}

export type ImportStepName =
  | 'fetch'
  | 'extract'
  | 'verify'
  | 'group'
  | 'normalize'
  | 'canonicalize'
  | 'save';

export type ImportStepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

export interface ImportSubStep {
  name: string;
  status: ImportStepStatus;
  message: string;
}

export interface ImportJobStep {
  step: ImportStepName;
  status: ImportStepStatus;
  message: string;
  subSteps: ImportSubStep[];
}

export type ImportJobStatus = 'queued' | 'running' | 'done' | 'error';

export interface ImportJobSnapshot {
  jobId: string;
  url: string;
  steps: ImportJobStep[];
  jobStatus: ImportJobStatus;
  result?: { id: string; title: string };
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
