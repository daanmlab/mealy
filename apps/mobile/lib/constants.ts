import type { FoodGoal, CookTimePreference } from '@mealy/types';

export const DISLIKES_OPTIONS = [
  'pork',
  'shellfish',
  'gluten',
  'dairy',
  'nuts',
  'eggs',
  'fish',
] as const;

export const GOALS: { value: FoodGoal; label: string; desc: string }[] = [
  { value: 'healthy', label: '🥗 Healthy', desc: 'Balanced, nutritious meals' },
  { value: 'easy', label: '⚡ Quick & easy', desc: 'Fast weeknight dinners' },
  { value: 'cheap', label: '💰 Budget', desc: 'Affordable ingredients' },
  { value: 'high_protein', label: '💪 High-protein', desc: 'Protein-rich meals' },
];

export const COOK_TIMES: { value: CookTimePreference; label: string }[] = [
  { value: 'under20', label: '< 20 min' },
  { value: 'under40', label: '< 40 min' },
  { value: 'any', label: 'Any' },
];
