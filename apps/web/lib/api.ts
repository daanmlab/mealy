// In production the API is proxied through Next.js rewrites at /api/*,
// so requests are same-origin and cookies work across domains.
// In local dev, NEXT_PUBLIC_API_URL points to http://localhost:3001.
// Auth headers are injected by proxy.ts (Next.js middleware) — not here.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ? '' : 'http://localhost:3001';

import type {
  User,
  UpdatePreferences,
  Recipe,
  RecipeIngredient,
  Ingredient,
  IngredientCategory,
  IngredientGroup,
  RecipeStep,
  Tag,
  Unit,
  Plan,
  PlanMeal,
  DayOfWeek,
  PlanStatus,
  GroceryList,
  GroceryItem,
  GroceryItemSource,
  FavoriteRecipe,
  FoodGoal,
  CookTimePreference,
  AdminRecipeListItem,
  ImportUrlDto,
  IngredientSearchResult,
  UpdateRecipeFullInput,
  AuditLogEntry,
} from '@mealy/types';

// Tag slugs are plain strings in the new schema
export type RecipeTag = string;

export type {
  User,
  UpdatePreferences,
  Recipe,
  RecipeIngredient,
  Ingredient,
  IngredientCategory,
  IngredientGroup,
  RecipeStep,
  Tag,
  Unit,
  Plan,
  PlanMeal,
  DayOfWeek,
  PlanStatus,
  GroceryList,
  GroceryItem,
  GroceryItemSource,
  FavoriteRecipe,
  FoodGoal,
  CookTimePreference,
  AdminRecipeListItem,
  ImportUrlDto,
  IngredientSearchResult,
  UpdateRecipeFullInput,
  AuditLogEntry,
};

// Called when NestJS returns 401 and there's no way to recover (e.g. session expired).
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb;
}

// ─── Core request ──────────────────────────────────────────────────────────────
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    onSessionExpired?.();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  // Used by the register page to create an account before calling signIn().
  register: (email: string, password: string, name?: string) =>
    api.post<{ id: string; email: string }>('/auth/register', { email, password, name }),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  me: () => api.get<User>('/users/me'),
  updateProfile: (data: { name?: string; email?: string }) =>
    api.patch<User>('/users/me/profile', data),
  updatePreferences: (data: Partial<UpdatePreferences>) =>
    api.patch<User>('/users/me/preferences', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch<void>('/users/me/password', data),
  deleteAccount: () => api.delete<void>('/users/me'),
};

// ─── Recipes ──────────────────────────────────────────────────────────────────
export const recipesApi = {
  list: (params?: { tags?: string[]; maxCookTime?: number }) => {
    const q = new URLSearchParams();
    if (params?.maxCookTime) q.set('maxCookTime', String(params.maxCookTime));
    params?.tags?.forEach((t) => q.append('tags', t));
    return api.get<Recipe[]>(`/recipes${q.toString() ? `?${q}` : ''}`);
  },
  get: (id: string) => api.get<Recipe>(`/recipes/${id}`),
};

// ─── Plans ────────────────────────────────────────────────────────────────────
export const plansApi = {
  create: (weekStart?: string) =>
    api.post<Plan>('/plans', weekStart ? { weekStart } : {}),
  current: (weekStart?: string) =>
    api.get<Plan | null>(`/plans/current${weekStart ? `?weekStart=${weekStart}` : ''}`),
  get: (id: string) => api.get<Plan>(`/plans/${id}`),
  swap: (planId: string, mealId: string, recipeId?: string) =>
    api.patch<PlanMeal>(`/plans/${planId}/meals/${mealId}/swap`, { recipeId }),
  lock: (planId: string, mealId: string) =>
    api.patch<PlanMeal>(`/plans/${planId}/meals/${mealId}/lock`),
  confirm: (planId: string) => api.post<Plan>(`/plans/${planId}/confirm`),
  regenerate: (planId: string) => api.post<Plan>(`/plans/${planId}/regenerate`),
  unlock: (planId: string) => api.post<Plan>(`/plans/${planId}/unlock`),
};

// ─── Grocery ──────────────────────────────────────────────────────────────────
export const groceryApi = {
  generate: (planId: string) => api.post<GroceryList>(`/plans/${planId}/grocery`),
  get: (planId: string) => api.get<GroceryList>(`/plans/${planId}/grocery`),
  toggle: (planId: string, itemId: string) =>
    api.patch<GroceryItem>(`/plans/${planId}/grocery/items/${itemId}/toggle`),
};

// ─── Favorites ────────────────────────────────────────────────────────────────
export const favoritesApi = {
  list: () => api.get<FavoriteRecipe[]>('/favorites'),
  add: (recipeId: string) => api.post<FavoriteRecipe>(`/favorites/${recipeId}`),
  remove: (recipeId: string) => api.delete<void>(`/favorites/${recipeId}`),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  listRecipes: (page = 1, limit = 50) =>
    api.get<{ items: AdminRecipeListItem[]; total: number; page: number; limit: number }>(
      `/admin/recipes?page=${page}&limit=${limit}`,
    ),
  getRecipe: (id: string) => api.get<Recipe>(`/recipes/${id}`),
  toggleActive: (id: string, isActive: boolean) =>
    api.patch<Recipe>(`/admin/recipes/${id}`, { isActive }),
  updateRecipe: (id: string, data: UpdateRecipeFullInput) =>
    api.patch<Recipe>(`/admin/recipes/${id}`, data),
  deleteRecipe: (id: string) => api.delete<void>(`/admin/recipes/${id}`),
  importFromUrl: (url: string) =>
    api.post<{ jobId: string; url: string }>('/admin/recipes/import-url', { url } satisfies ImportUrlDto),
  searchIngredients: (q: string, limit = 20) =>
    api.get<IngredientSearchResult[]>(
      `/admin/ingredients/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  getUnits: () => api.get<Unit[]>('/admin/units'),
  getIngredientCategories: () =>
    api.get<IngredientCategory[]>('/admin/ingredient-categories'),
  getTags: () => api.get<Tag[]>('/admin/tags'),
  suggestTags: (recipeId: string) =>
    api.post<string[]>(`/admin/recipes/${recipeId}/suggest-tags`, {}),
  renameTag: (id: string, name: string) =>
    api.patch<Tag>(`/admin/tags/${id}`, { name }),
  deleteTag: (id: string) => api.delete<void>(`/admin/tags/${id}`),
  getAuditLogs: (page = 1, limit = 50) =>
    api.get<{ items: AuditLogEntry[]; total: number; page: number; limit: number }>(
      `/admin/audit-logs?page=${page}&limit=${limit}`,
    ),
};
