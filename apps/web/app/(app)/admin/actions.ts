'use server';

import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `refresh_token=${refreshToken}` },
    body: JSON.stringify({ refreshToken: '' }),
    cache: 'no-store',
  });

  if (!res.ok) return null;

  // The API rotates the refresh token on every call — propagate the new cookie to the browser.
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/refresh_token=([^;]+)/);
    if (match?.[1]) {
      cookieStore.set('refresh_token', match[1], {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }

  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

export async function importRecipeFromUrl(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const url = formData.get('url') as string;
  if (!url) return { error: 'URL is required' };

  const token = await getAccessToken();
  if (!token) return { error: 'Not authenticated' };

  const res = await fetch(`${API_BASE}/api/admin/recipes/import-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `API error ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
    } catch {
      /* ignore */
    }
    return { error: message };
  }

  const recipe = (await res.json()) as { title: string };
  return { success: `"${recipe.title}" imported successfully (inactive — review before publishing)` };
}

export async function toggleRecipeActive(id: string, isActive: boolean): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/admin/recipes/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isActive }),
  });

  if (!res.ok) throw new Error(`Failed to update recipe: ${res.status}`);
}

export async function deleteRecipe(id: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/api/admin/recipes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Failed to delete recipe: ${res.status}`);
}
