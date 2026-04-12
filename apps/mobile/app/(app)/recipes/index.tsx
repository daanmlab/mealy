import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { recipesApi, favoritesApi, type Recipe } from '@/lib/api';

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    Promise.all([recipesApi.list(), favoritesApi.list()])
      .then(([r, favs]) => {
        setRecipes(r);
        setFavoriteIds(new Set(favs.map((f) => f.recipeId)));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFav(recipe: Recipe) {
    if (favoriteIds.has(recipe.id)) {
      await favoritesApi.remove(recipe.id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(recipe.id);
        return next;
      });
    } else {
      await favoritesApi.add(recipe.id);
      setFavoriteIds((prev) => new Set([...prev, recipe.id]));
    }
  }

  // Collect all tags
  const allTags = Array.from(
    new Set(recipes.flatMap((r) => r.tags.map((t) => t.tag.slug))),
  ).sort();

  const filtered = recipes.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag = selectedTag == null || r.tags.some((t) => t.tag.slug === selectedTag);
    return matchesSearch && matchesTag;
  });

  if (loading) {
    return (
      <View className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#5c6b3a" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="text-gray-400 text-center mb-4">Failed to load recipes.</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            setError(false);
            Promise.all([recipesApi.list(), favoritesApi.list()])
              .then(([r, favs]) => {
                setRecipes(r);
                setFavoriteIds(new Set(favs.map((f) => f.recipeId)));
              })
              .catch(() => setError(true))
              .finally(() => setLoading(false));
          }}
          className="bg-olive px-5 py-2.5 rounded-xl"
        >
          <Text className="text-white font-medium text-sm">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      {/* Search */}
      <View className="px-4 pt-3 pb-2">
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white"
          placeholder="Search recipes…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Tag filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['all', ...allTags]}
        keyExtractor={(t) => t}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}
        renderItem={({ item }) => {
          const active = item === 'all' ? selectedTag === null : selectedTag === item;
          return (
            <TouchableOpacity
              onPress={() => setSelectedTag(item === 'all' ? null : item)}
              className={`px-3 py-1.5 rounded-full border ${
                active ? 'bg-olive border-olive' : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-xs font-medium capitalize ${active ? 'text-white' : 'text-gray-600'}`}>
                {item === 'all' ? 'All' : item.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Recipe grid */}
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
        columnWrapperStyle={{ gap: 8 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden"
            onPress={() => router.push(`/(app)/recipes/${item.id}`)}
          >
            <View className="p-3">
              <Text className="font-semibold text-gray-900 text-sm leading-snug" numberOfLines={2}>
                {item.title}
              </Text>
              <Text className="text-xs text-gray-400 mt-1">⏱ {item.cookTimeMinutes} min</Text>
              <View className="flex-row flex-wrap gap-1 mt-2">
                {item.tags.slice(0, 2).map((t) => (
                  <View key={t.tag.slug} className="px-1.5 py-0.5 bg-olive-subtle rounded">
                    <Text className="text-[10px] text-olive font-medium capitalize">
                      {t.tag.slug.replace(/_/g, ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => toggleFav(item)}
              className="absolute top-2 right-2 p-1"
            >
              <Text className="text-base">{favoriteIds.has(item.id) ? '♥' : '♡'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
