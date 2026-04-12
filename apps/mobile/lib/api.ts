import { getToken } from './auth';
import type {
  User,
  UpdatePreferences,
  Recipe,
  Plan,
  PlanMeal,
  GroceryList,
  GroceryItem,
  FavoriteRecipe,
  Tag,
  Unit,
  IngredientCategory,
} from '@mealy/types';

export type {
  User,
  UpdatePreferences,
  Recipe,
  Plan,
  PlanMeal,
  GroceryList,
  GroceryItem,
  FavoriteRecipe,
  Tag,
  Unit,
  IngredientCategory,
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Called when 401 is received (e.g. token expired).
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
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

const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  user: User;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResult>('/auth/login', { email, password }),
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
