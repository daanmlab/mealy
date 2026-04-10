// In production the API is proxied through Next.js rewrites at /api/*,
// so requests are same-origin and cookies work across domains.
// In local dev, NEXT_PUBLIC_API_URL points to http://localhost:3001.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ? '' : 'http://localhost:3001';

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
};

let accessToken: string | null = null;

// Registered by AuthProvider; called when the refresh token is expired/invalid
// so the app can clear state and redirect to /login.
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb;
}

// ─── Refresh-token machinery ───────────────────────────────────────────────────
// Only one refresh request is ever in-flight at a time. Any other request that
// hits a 401 while a refresh is already running waits for the same promise
// instead of firing its own /auth/refresh call.
let isRefreshing = false;
let refreshSubscribers: Array<(success: boolean) => void> = [];

function subscribeToRefresh(cb: (success: boolean) => void) {
  refreshSubscribers.push(cb);
}

function notifyRefreshSubscribers(success: boolean) {
  refreshSubscribers.forEach((cb) => cb(success));
  refreshSubscribers = [];
}

async function tryRefresh(): Promise<boolean> {
  // If a refresh is already in-flight, wait for it instead of starting another
  if (isRefreshing) {
    return new Promise<boolean>((resolve) => {
      subscribeToRefresh(resolve);
    });
  }

  isRefreshing = true;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: '' }),
    });

    if (!res.ok) {
      // Refresh token is expired or invalid — clear everything and signal the app
      setAccessToken(null);
      notifyRefreshSubscribers(false);
      onSessionExpired?.();
      return false;
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    notifyRefreshSubscribers(true);
    return true;
  } catch {
    setAccessToken(null);
    notifyRefreshSubscribers(false);
    onSessionExpired?.();
    return false;
  } finally {
    isRefreshing = false;
  }
}

// ─── Core request ──────────────────────────────────────────────────────────────
async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
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

  // Only attempt a silent token refresh once per original request, and never
  // for the refresh endpoint itself (that would cause infinite recursion).
  if (res.status === 401 && path !== '/auth/refresh' && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request with the new access token
      return request<T>(path, init, true);
    }
    // Refresh failed — onSessionExpired has already been called; just surface the error
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
  register: (email: string, password: string, name?: string) =>
    api.post<{ accessToken: string }>('/auth/register', { email, password, name }),
  login: (email: string, password: string) =>
    api.post<{ accessToken: string }>('/auth/login', { email, password }),
  refresh: (refreshToken?: string) =>
    api.post<{ accessToken: string }>('/auth/refresh', { refreshToken: refreshToken ?? '' }),
  logout: () => api.post<void>('/auth/logout'),
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
    api.patch<AdminRecipeListItem>(`/admin/recipes/${id}`, { isActive }),
  deleteRecipe: (id: string) => api.delete<void>(`/admin/recipes/${id}`),
  importFromUrl: (url: string) =>
    api.post<Recipe>('/admin/recipes/import-url', { url } satisfies ImportUrlDto),
};
