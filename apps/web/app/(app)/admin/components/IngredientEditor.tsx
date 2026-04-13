'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import type { IngredientSearchResult, Unit, IngredientCategory } from '@/lib/api';

export interface IngredientRow {
  /** Unique local key (not persisted) */
  _key: string;
  ingredientId: string | null;
  name: string;
  amount: number;
  unitSymbol: string;
  categorySlug: string;
  groupName: string;
  /** Whether name matched an existing canonical ingredient */
  isExisting: boolean;
}

interface Props {
  rows: IngredientRow[];
  units: Unit[];
  categories: IngredientCategory[];
  onChange: (rows: IngredientRow[]) => void;
}

let rowCounter = 0;
export function makeIngredientRow(partial: Partial<IngredientRow> = {}): IngredientRow {
  return {
    _key: `row-${++rowCounter}`,
    ingredientId: null,
    name: '',
    amount: 1,
    unitSymbol: 'g',
    categorySlug: 'other',
    groupName: '',
    isExisting: false,
    ...partial,
  };
}

function useDebouncedSearch(query: string, delay: number) {
  const [results, setResults] = useState<IngredientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await adminApi.searchIngredients(query, 8);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, delay]);

  return { results, searching };
}

function IngredientNameInput({
  row,
  onChange,
}: {
  row: IngredientRow;
  onChange: (patch: Partial<IngredientRow>) => void;
}) {
  const [inputValue, setInputValue] = useState(row.name);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { results, searching } = useDebouncedSearch(inputValue, 250);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (ingredient: IngredientSearchResult) => {
    setInputValue(ingredient.name);
    setOpen(false);
    onChange({
      name: ingredient.name,
      ingredientId: ingredient.id,
      categorySlug: ingredient.category?.slug ?? 'other',
      isExisting: true,
    });
  };

  const handleBlur = () => {
    // Short delay so click on dropdown fires first
    setTimeout(() => {
      setOpen(false);
      // If user typed a custom name that didn't match, mark as new
      if (inputValue !== row.name || !row.ingredientId) {
        onChange({ name: inputValue, ingredientId: null, isExisting: false });
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
            // Clear the matched ID if user edits
            onChange({ name: e.target.value, ingredientId: null, isExisting: false });
          }}
          onFocus={() => { if (inputValue.trim()) setOpen(true); }}
          onBlur={handleBlur}
          placeholder="Ingredient name…"
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        {/* Status badge */}
        {inputValue.trim() && (
          <span
            title={row.isExisting ? 'Matches canonical ingredient' : 'New ingredient (will be created)'}
            className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
              row.isExisting
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {row.isExisting ? '✓' : 'new'}
          </span>
        )}
      </div>

      {open && (inputValue.trim()) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {searching && (
            <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>
          )}
          {!searching && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">
              No matches — will create &ldquo;{inputValue}&rdquo; as a new ingredient
            </p>
          )}
          {results.map((ing) => (
            <button
              key={ing.id}
              type="button"
              onMouseDown={() => handleSelect(ing)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="flex-1 truncate">{ing.name}</span>
              {ing.category && (
                <span className="text-xs text-gray-400 shrink-0">{ing.category.name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function IngredientEditor({ rows, units, categories, onChange }: Props) {
  const updateRow = useCallback(
    (key: string, patch: Partial<IngredientRow>) => {
      onChange(rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
    },
    [rows, onChange],
  );

  const removeRow = (key: string) => {
    onChange(rows.filter((r) => r._key !== key));
  };

  const addRow = () => {
    onChange([...rows, makeIngredientRow()]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = rows.findIndex((r) => r._key === active.id);
    const newIdx = rows.findIndex((r) => r._key === over.id);
    onChange(arrayMove(rows, oldIdx, newIdx));
  };

  // Build a set of duplicated lowercase names for warning
  const nameCounts = new Map<string, number>();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (key) nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide grid grid-cols-[16px_1fr_90px_80px_140px_90px_32px] gap-2 px-1">
        <span />
        <span>Name</span>
        <span>Amount</span>
        <span>Unit</span>
        <span>Category</span>
        <span>Group</span>
        <span />
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
          No ingredients yet — add one below
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r._key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {rows.map((row) => {
              const hasAmountWarning = row.amount === 0 || row.amount >= 1000;
              const isDuplicate = (nameCounts.get(row.name.trim().toLowerCase()) ?? 0) > 1;
              return (
                <SortableIngredientRow
                  key={row._key}
                  row={row}
                  units={units}
                  categories={categories}
                  hasAmountWarning={hasAmountWarning}
                  isDuplicate={isDuplicate}
                  onUpdate={(patch) => updateRow(row._key, patch)}
                  onRemove={() => removeRow(row._key)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-sm text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 hover:border-gray-500 rounded-lg px-4 py-2 w-full transition-colors"
      >
        + Add ingredient
      </button>
    </div>
  );
}

function SortableIngredientRow({
  row,
  units,
  categories,
  hasAmountWarning,
  isDuplicate,
  onUpdate,
  onRemove,
}: {
  row: IngredientRow;
  units: Unit[];
  categories: IngredientCategory[];
  hasAmountWarning: boolean;
  isDuplicate: boolean;
  onUpdate: (patch: Partial<IngredientRow>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row._key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[16px_1fr_90px_80px_140px_90px_32px] gap-2 items-center rounded-lg px-1 py-0.5 ${isDuplicate ? 'bg-amber-50' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors text-base leading-none"
        title="Drag to reorder"
        aria-label="Drag to reorder ingredient"
      >
        ⠿
      </button>

      <div className="flex items-center gap-1 min-w-0">
        <IngredientNameInput row={row} onChange={onUpdate} />
        {isDuplicate && (
          <span title="Duplicate ingredient name" className="shrink-0 text-amber-500 text-sm">⚠</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step="any"
          value={row.amount}
          onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
          className={`w-full px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 ${hasAmountWarning ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}
        />
        {hasAmountWarning && (
          <span
            title={row.amount === 0 ? 'Amount is zero' : 'Amount seems unusually large'}
            className="shrink-0 text-amber-500 text-sm"
          >
            ⚠
          </span>
        )}
      </div>

      <select
        value={row.unitSymbol}
        onChange={(e) => onUpdate({ unitSymbol: e.target.value })}
        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      >
        <option value="unit">—</option>
        {units.map((u) => (
          <option key={u.id} value={u.symbol}>{u.symbol}</option>
        ))}
      </select>

      <select
        value={row.categorySlug}
        onChange={(e) => onUpdate({ categorySlug: e.target.value })}
        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>{c.name}</option>
        ))}
      </select>

      <input
        type="text"
        value={row.groupName}
        onChange={(e) => onUpdate({ groupName: e.target.value })}
        placeholder="Group…"
        className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      <button
        type="button"
        onClick={onRemove}
        className="text-gray-300 hover:text-red-500 transition-colors text-xs"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}
