import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { recipesApi, type Recipe, type Plan } from '@/lib/api';

const TAG_OPTIONS: { label: string; value: string | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: '⚡ Quick', value: 'quick' },
  { label: '🥗 Healthy', value: 'healthy' },
  { label: '🌿 Vegetarian', value: 'vegetarian' },
  { label: '💪 Protein', value: 'high_protein' },
  { label: '💰 Budget', value: 'cheap' },
  { label: '🍝 Pasta', value: 'pasta' },
  { label: '🥣 Bowl', value: 'bowl' },
  { label: '🍲 Soup', value: 'soup' },
];

interface Props {
  visible: boolean;
  plan?: Plan | null;
  currentRecipeId?: string;
  onSelect: (recipeId: string) => void;
  onClose: () => void;
}

export default function SwapPickerModal({ visible, plan, currentRecipeId, onSelect, onClose }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setActiveTag('all');
    setLoading(true);
    recipesApi.list()
      .then((r) => setRecipes(r))
      .finally(() => setLoading(false));
  }, [visible]);

  const planRecipeIds = new Set(plan?.meals.map((m) => m.recipe.id) ?? []);
  const isFiltering = search.trim() !== '' || activeTag !== 'all';

  const suggestions = recipes
    .filter((r) => !planRecipeIds.has(r.id) && r.id !== currentRecipeId)
    .slice(0, 5);

  const filtered = recipes.filter((r) => {
    const matchesSearch = search.trim() === '' || r.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchesTag = activeTag === 'all' || r.tags.some((t) => t.tag.slug === activeTag);
    return matchesSearch && matchesTag;
  });

  function RecipeRow({ item }: { item: Recipe }) {
    return (
      <TouchableOpacity
        onPress={() => onSelect(item.id)}
        className={`py-4 border-b border-gray-50 flex-row items-center gap-3 ${
          item.id === currentRecipeId ? 'opacity-40' : ''
        }`}
        disabled={item.id === currentRecipeId}
      >
        <View className="flex-1">
          <Text className="font-medium text-gray-900 text-sm">{item.title}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">⏱ {item.cookTimeMinutes} min</Text>
        </View>
        <View className="flex-row flex-wrap gap-1">
          {item.tags.slice(0, 2).map((t) => (
            <View key={t.tag.slug} className="px-1.5 py-0.5 bg-olive-subtle rounded">
              <Text className="text-[10px] text-olive font-medium capitalize">
                {t.tag.slug.replace('_', '-')}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <Text className="text-lg font-semibold text-gray-900">Pick a recipe</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Text className="text-gray-400 text-xl">✕</Text>
          </TouchableOpacity>
        </View>

        <View className="px-4 py-3">
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50"
            placeholder="Search recipes…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Tag filter strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
        >
          {TAG_OPTIONS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              onPress={() => setActiveTag(value)}
              className={`px-3 py-1.5 rounded-full border ${
                activeTag === value ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-xs font-medium ${activeTag === value ? 'text-white' : 'text-gray-600'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#5c6b3a" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            ListHeaderComponent={
              !isFiltering && suggestions.length > 0 ? (
                <View>
                  <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2 mb-1">
                    Suggestions
                  </Text>
                  {suggestions.map((r) => (
                    <RecipeRow key={r.id} item={r} />
                  ))}
                  <View className="border-t border-gray-100 mt-2 mb-2" />
                  <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Browse all
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => <RecipeRow item={item} />}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
