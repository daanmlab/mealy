import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { groceryApi, type GroceryItem } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  produce: '🥦 Produce',
  meat: '🥩 Meat',
  seafood: '🐟 Seafood',
  dairy: '🧀 Dairy',
  grains: '🌾 Grains & Pasta',
  canned: '🥫 Canned & Pantry',
  condiments: '🫙 Condiments',
  spices: '🌿 Spices',
  frozen: '🧊 Frozen',
  other: '📦 Other',
};

interface Props {
  planId: string;
  items: GroceryItem[];
  onItemsChange: (items: GroceryItem[]) => void;
  onRegenerate: () => void;
  regenerating?: boolean;
}

function formatAmount(amount: number): string {
  return amount % 1 === 0 ? String(amount) : amount.toFixed(1);
}

function groupByCategory(items: GroceryItem[]): [string, GroceryItem[]][] {
  const map = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const cat = item.ingredient.category?.slug ?? 'other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default function GroceryList({ planId, items, onItemsChange, onRegenerate, regenerating }: Props) {
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  async function toggle(item: GroceryItem) {
    if (toggling.has(item.id)) return;
    setToggling((prev) => new Set(prev).add(item.id));
    try {
      const updated = await groceryApi.toggle(planId, item.id);
      onItemsChange(items.map((i) => (i.id === item.id ? { ...i, isChecked: updated.isChecked } : i)));
    } finally {
      setToggling((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  }

  const checkedCount = items.filter((i) => i.isChecked).length;
  const total = items.length;
  const grouped = groupByCategory(items);

  type Section = { type: 'header'; category: string } | { type: 'item'; item: GroceryItem };
  const sectionData: Section[] = [];
  for (const [cat, catItems] of grouped) {
    sectionData.push({ type: 'header', category: cat });
    for (const item of catItems) {
      sectionData.push({ type: 'item', item });
    }
  }

  return (
    <FlatList
      data={sectionData}
      keyExtractor={(row) => row.type === 'header' ? `h-${row.category}` : row.item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      ListHeaderComponent={
        <View className="mt-4 mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-base font-semibold text-gray-900">Grocery list</Text>
            <TouchableOpacity
              onPress={onRegenerate}
              disabled={regenerating}
              className="px-3 py-1.5 border border-gray-200 rounded-lg"
              style={{ opacity: regenerating ? 0.5 : 1 }}
            >
              <Text className="text-xs text-gray-500">{regenerating ? '…' : 'Regenerate'}</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-gray-400 mb-2">{checkedCount}/{total} items checked</Text>
          <View className="h-1.5 bg-gray-100 rounded-full">
            <View
              className="h-full bg-olive rounded-full"
              style={{ width: total ? `${(checkedCount / total) * 100}%` : '0%' }}
            />
          </View>
        </View>
      }
      renderItem={({ item: row }) => {
        if (row.type === 'header') {
          return (
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-1">
              {CATEGORY_LABELS[row.category] ?? row.category}
            </Text>
          );
        }
        const { item } = row;
        return (
          <TouchableOpacity
            onPress={() => toggle(item)}
            disabled={toggling.has(item.id)}
            className={`flex-row items-center gap-3 py-3 border-b border-gray-50 ${
              toggling.has(item.id) ? 'opacity-60' : ''
            }`}
          >
            <View
              className={`w-5 h-5 rounded border-2 items-center justify-center ${
                item.isChecked ? 'border-olive bg-olive' : 'border-gray-300'
              }`}
            >
              {item.isChecked && (
                <Text className="text-white text-xs font-bold">✓</Text>
              )}
            </View>
            <View className="flex-1">
              <Text
                className={`text-sm ${
                  item.isChecked ? 'text-gray-300 line-through' : 'text-gray-800'
                }`}
              >
                {item.ingredient.name}
              </Text>
              {item.sources && item.sources.length > 0 && (
                <Text className="text-[10px] text-gray-400 mt-0.5" numberOfLines={1}>
                  {item.sources.map((s) => s.recipe.title).join(', ')}
                </Text>
              )}
            </View>
            <Text className="text-xs text-gray-400">
              {item.totalAmount > 0 ? `${formatAmount(item.totalAmount)} ` : ''}{item.unit?.symbol ?? ''}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}
