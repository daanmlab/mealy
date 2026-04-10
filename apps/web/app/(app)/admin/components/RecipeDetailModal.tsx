'use client';

import { useEffect, useRef } from 'react';
import type { Recipe } from '@/lib/api';

interface Props {
  recipe: Recipe | null;
  onClose: () => void;
}

export function RecipeDetailModal({ recipe, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (recipe) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [recipe]);

  if (!recipe) return null;

  const byGroup = recipe.ingredients.reduce<Record<string, typeof recipe.ingredients>>(
    (acc, ing) => {
      const key = ing.group?.name ?? '';
      (acc[key] ??= []).push(ing);
      return acc;
    },
    {},
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  recipe.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${recipe.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                {recipe.isActive ? 'Active' : 'Inactive'}
              </span>
              {recipe.tags.map(({ tag }) => (
                <span key={tag.id} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{recipe.title}</h2>
            {recipe.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <div className="flex gap-6 text-sm text-gray-600">
            <span>🕐 {recipe.cookTimeMinutes} min</span>
            <span>🍽 {recipe.servings} servings</span>
            <span>🥕 {recipe.ingredients.length} ingredients</span>
            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-blue-500 hover:underline truncate max-w-[200px]"
              >
                Source ↗
              </a>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Ingredients</h3>
            {Object.entries(byGroup).map(([group, items]) => (
              <div key={group} className="mb-3">
                {group && (
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{group}</p>
                )}
                <ul className="space-y-1">
                  {items.map((ri) => (
                    <li key={ri.id} className="flex items-baseline gap-1.5 text-sm text-gray-700">
                      <span className="font-medium">
                        {ri.amount != null ? ri.amount : ''}
                        {ri.unit ? ` ${ri.unit.name}` : ''}
                      </span>
                      <span>{ri.ingredient.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {recipe.steps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Instructions</h3>
              <ol className="space-y-3">
                {recipe.steps.map((step, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-700">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center mt-0.5">
                      {step.order}
                    </span>
                    <span className="leading-relaxed">{step.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
