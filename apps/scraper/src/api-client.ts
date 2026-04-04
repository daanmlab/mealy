import { NormalizedRecipe } from './normalizer';

export interface ScrapeResult {
  url: string;
  success: boolean;
  recipeId?: string;
  title?: string;
  error?: string;
}

export async function postRecipe(
  recipe: NormalizedRecipe,
  apiUrl: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(`${apiUrl}/recipes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(recipe),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}
