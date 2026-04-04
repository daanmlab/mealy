const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

import type {
  User,
  UpdatePreferences,
  Recipe,
  RecipeIngredient,
  Ingredient,
  RecipeStep,
  RecipeTag,
  IngredientCategory,
  Plan,
  PlanMeal,
  DayOfWeek,
  PlanStatus,
  GroceryList,
  GroceryItem,
  FavoriteRecipe,
  FoodGoal,
  CookTimePreference,
} from '@mealy/types';

export type {
  User,
  UpdatePreferences,
  Recipe,
  RecipeIngredient,
  Ingredient,
  RecipeStep,
  RecipeTag,
  IngredientCategory,
  Plan,
  PlanMeal,
  DayOfWeek,
  PlanStatus,
  GroceryList,
  GroceryItem,
  FavoriteRecipe,
  FoodGoal,
  CookTimePreference,
};

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && path !== '/auth/refresh') {
    // Attempt silent token refresh
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(`${API_BASE}/api${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });
      if (!retry.ok) throw new ApiError(retry.status, await retry.text());
      if (retry.status === 204) return undefined as T;
      const retryText = await retry.text();
      if (!retryText) return undefined as T;
      return JSON.parse(retryText) as T;
    }
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

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: '' }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
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
  register: (email: string, password: string, name?: string) =>
    api.post<{ accessToken: string }>('/auth/register', { email, password, name }),
  login: (email: string, password: string) =>
    api.post<{ accessToken: string }>('/auth/login', { email, password }),
  refresh: () => api.post<{ accessToken: string }>('/auth/refresh', { refreshToken: '' }),
  logout: () => api.post<void>('/auth/logout'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  me: () => api.get<User>('/users/me'),
  updatePreferences: (data: Partial<UpdatePreferences>) =>
    api.patch<User>('/users/me/preferences', data),
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
