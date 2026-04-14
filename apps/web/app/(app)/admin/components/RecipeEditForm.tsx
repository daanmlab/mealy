'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminApi } from '@/lib/api';
import type { Recipe, Unit, IngredientCategory, Tag } from '@/lib/api';
import { IngredientEditor, type IngredientRow } from './IngredientEditor';

interface Props {
  recipe: Recipe;
  units: Unit[];
  categories: IngredientCategory[];
  allTags: Tag[];
  onSaved: (updated: Recipe) => void;
  onCancel: () => void;
}

interface StepRow {
  _key: string;
  order: number;
  text: string;
}

let stepCounter = 0;
function makeStep(text = '', order = 1): StepRow {
  return { _key: `step-${++stepCounter}`, order, text };
}

function recipeToIngredientRows(recipe: Recipe): IngredientRow[] {
  let keyId = 0;
  return recipe.ingredients.map((ri) => ({
    _key: `existing-${++keyId}`,
    ingredientId: ri.ingredient.id,
    name: ri.ingredient.name,
    amount: ri.amount,
    unitSymbol: ri.unit?.symbol ?? 'unit',
    categorySlug: ri.ingredient.category?.slug ?? 'other',
    groupName: ri.group?.name ?? '',
    isExisting: true,
  }));
}

function recipeToStepRows(recipe: Recipe): StepRow[] {
  return recipe.steps.map((s) => makeStep(s.text, s.order));
}

function SortableStepRow({
  step,
  idx,
  total,
  onUpdate,
  onRemove,
}: {
  step: StepRow;
  idx: number;
  total: number;
  onUpdate: (key: string, text: string) => void;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step._key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="flex gap-3 items-start">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 mt-2.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors"
        title="Drag to reorder"
        aria-label={`Drag step ${idx + 1}`}
      >
        ⠿
      </button>
      <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center mt-2">
        {idx + 1}
      </span>
      <textarea
        rows={2}
        value={step.text}
        onChange={(e) => onUpdate(step._key, e.target.value)}
        placeholder="Describe this step…"
        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
      />
      <button
        type="button"
        onClick={() => onRemove(step._key)}
        className="shrink-0 mt-2 p-1 text-gray-300 hover:text-red-500 text-xs transition-colors"
        title="Remove step"
        aria-label={`Remove step ${idx + 1}`}
        disabled={total === 1}
      >
        ✕
      </button>
    </li>
  );
}

export function RecipeEditForm({ recipe, units, categories, allTags, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description);
  const [cookTimeMinutes, setCookTimeMinutes] = useState(recipe.cookTimeMinutes);
  const [servings, setServings] = useState(recipe.servings);
  const [sourceUrl, setSourceUrl] = useState(recipe.sourceUrl ?? '');
  const [isActive, setIsActive] = useState(recipe.isActive);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<Set<string>>(
    () => new Set(recipe.tags.map(({ tag }) => tag.slug)),
  );
  const [customTags, setCustomTags] = useState<{ slug: string; name: string }[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRow[]>(() => recipeToStepRows(recipe));
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    recipeToIngredientRows(recipe),
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Track unsaved changes
  useEffect(() => {
    setIsDirty(true);
  }, [title, description, cookTimeMinutes, servings, sourceUrl, isActive, selectedTagSlugs, steps, ingredients]);

  // Warn on page unload if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !saveSuccess) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, saveSuccess]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const tagSlugs = [
      ...selectedTagSlugs,
      ...customTags.filter((t) => selectedTagSlugs.has(t.slug)).map((t) => t.slug),
    ];

    const sortedSteps = [...steps]
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ order: i + 1, text: s.text.trim() }))
      .filter((s) => s.text);

    const ingredientPayload = ingredients
      .filter((r) => r.name.trim())
      .map((r) => ({
        ...(r.ingredientId ? { ingredientId: r.ingredientId } : {}),
        name: r.name.trim(),
        amount: r.amount,
        unitSymbol: r.unitSymbol || 'unit',
        categorySlug: r.categorySlug || 'other',
        ...(r.groupName.trim() ? { groupName: r.groupName.trim() } : {}),
      }));

    try {
      const updated = await adminApi.updateRecipe(recipe.id, {
        title: title.trim(),
        description: description.trim(),
        cookTimeMinutes,
        servings,
        sourceUrl: sourceUrl.trim() || null,
        isActive,
        steps: sortedSteps,
        tagSlugs,
        ingredients: ingredientPayload,
      });
      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => onSaved(updated), 800);
    } catch (err) {
      let message = 'Failed to save recipe';
      if (err instanceof Error) {
        try {
          const body = JSON.parse(err.message) as { message?: string | string[] };
          message = Array.isArray(body.message)
            ? body.message.join('; ')
            : (body.message ?? err.message);
        } catch {
          message = err.message;
        }
      }
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [title, description, cookTimeMinutes, servings, sourceUrl, isActive, selectedTagSlugs, customTags, steps, ingredients, recipe.id, onSaved]);

  const handleAddCustomTag = () => {
    const name = newTagInput.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) return;
    if (!customTags.find((t) => t.slug === slug) && !allTags.find((t) => t.slug === slug)) {
      setCustomTags((prev) => [...prev, { slug, name }]);
    }
    setSelectedTagSlugs((prev) => new Set([...prev, slug]));
    setNewTagInput('');
  };

  const handleSuggestTags = async () => {
    setSuggestingTags(true);
    setSuggestError(null);
    try {
      const result = await adminApi.suggestTags(recipe.id);
      setSelectedTagSlugs((prev) => new Set([...prev, ...result]));
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'AI suggestion failed');
    } finally {
      setSuggestingTags(false);
    }
  };

  const handleCancel = () => {
    if (isDirty && !confirm('Discard unsaved changes?')) return;
    onCancel();
  };

  // ─── Step helpers ─────────────────────────────────────────────────────────────
  const addStep = () => {
    const maxOrder = steps.reduce((m, s) => Math.max(m, s.order), 0);
    setSteps((prev) => [...prev, makeStep('', maxOrder + 1)]);
  };

  const updateStep = (key: string, text: string) => {
    setSteps((prev) => prev.map((s) => (s._key === key ? { ...s, text } : s)));
  };

  const removeStep = (key: string) => {
    setSteps((prev) => prev.filter((s) => s._key !== key));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleStepDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...steps].sort((a, b) => a.order - b.order);
    const oldIdx = sorted.findIndex((s) => s._key === active.id);
    const newIdx = sorted.findIndex((s) => s._key === over.id);
    const reordered = arrayMove(sorted, oldIdx, newIdx).map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(reordered);
  };

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
    >
      {/* ─── Core fields ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Recipe Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cook time (min)</label>
            <input
              type="number"
              min={1}
              max={600}
              value={cookTimeMinutes}
              onChange={(e) => setCookTimeMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Servings</label>
            <input
              type="number"
              min={1}
              max={50}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source URL</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-600">Tags</label>
              <button
                type="button"
                onClick={handleSuggestTags}
                disabled={suggestingTags}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 rounded-full transition-colors"
              >
                {suggestingTags ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    Suggesting…
                  </>
                ) : (
                  <>✨ Suggest with AI</>
                )}
              </button>
            </div>
            {suggestError && (
              <p className="mt-1 text-xs text-red-500">⚠ {suggestError}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const selected = selectedTagSlugs.has(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() =>
                      setSelectedTagSlugs((prev) => {
                        const next = new Set(prev);
                        if (next.has(tag.slug)) next.delete(tag.slug);
                        else next.add(tag.slug);
                        return next;
                      })
                    }
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}

              {customTags.map((tag) => {
                const selected = selectedTagSlugs.has(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() =>
                      setSelectedTagSlugs((prev) => {
                        const next = new Set(prev);
                        if (next.has(tag.slug)) next.delete(tag.slug);
                        else next.add(tag.slug);
                        return next;
                      })
                    }
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                    title="Custom tag (will be created on save)"
                  >
                    {tag.name} <span className="opacity-60 text-xs">+</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                placeholder="New tag name…"
                className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                disabled={!newTagInput.trim()}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-lg transition-colors"
              >
                Add
              </button>
            </div>

            {selectedTagSlugs.size === 0 && (
              <p className="mt-1.5 text-xs text-gray-400">No tags selected</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600">Active</label>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs text-gray-500">{isActive ? 'Visible to users' : 'Hidden'}</span>
          </div>
        </div>
      </section>

      {/* ─── Steps ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Instructions</h2>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
          <SortableContext items={sortedSteps.map((s) => s._key)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-3">
              {sortedSteps.map((step, idx) => (
                <SortableStepRow
                  key={step._key}
                  step={step}
                  idx={idx}
                  total={sortedSteps.length}
                  onUpdate={updateStep}
                  onRemove={removeStep}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={addStep}
          className="text-sm text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 hover:border-gray-500 rounded-lg px-4 py-2 w-full transition-colors"
        >
          + Add step
        </button>
      </section>

      {/* ─── Ingredients ─── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Ingredients</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Green <span className="text-green-700 font-medium">✓</span> = matched to canonical ingredient.{' '}
            <span className="text-amber-600 font-medium">new</span> = will be created on save.
          </p>
        </div>
        <IngredientEditor
          rows={ingredients}
          units={units}
          categories={categories}
          onChange={setIngredients}
        />
      </section>

      {/* ─── Actions ─── */}
      <div className="flex items-center justify-between sticky bottom-0 bg-gray-50 border-t border-gray-200 -mx-4 px-6 py-4 rounded-b-xl">
        <div>
          {saveError && (
            <p className="text-sm text-red-600 max-w-lg">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-sm text-green-600">Saved successfully — redirecting…</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || saveSuccess}
            className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : saveSuccess ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
