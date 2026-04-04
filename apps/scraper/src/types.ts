export interface RawIngredient {
  name: string;
  amount: number;
  unit: string;
  groupName?: string;
}

export interface RawRecipe {
  title: string;
  description: string;
  cookTimeMinutes: number;
  servings: number;
  imageUrl?: string;
  sourceUrl?: string;
  keywords: string[];
  steps: string[];
  ingredients: RawIngredient[];
}
