import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { favoritesApi, type FavoriteRecipe } from '@/lib/api';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    favoritesApi.list()
      .then(setFavorites)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function remove(recipeId: string) {
    await favoritesApi.remove(recipeId);
    setFavorites((prev) => prev.filter((f) => f.recipeId !== recipeId));
  }

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
        <Text className="text-gray-400 text-center mb-4">Failed to load favorites.</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            setError(false);
            favoritesApi.list()
              .then(setFavorites)
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
      {favorites.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">♡</Text>
          <Text className="text-lg font-semibold text-gray-700 mb-1">No favorites yet</Text>
          <Text className="text-sm text-gray-400 text-center">
            Tap the heart icon on any recipe to save it here.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/recipes')}
            className="mt-4 bg-olive px-5 py-2.5 rounded-xl"
          >
            <Text className="text-white font-medium text-sm">Browse recipes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(f) => f.recipeId}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-white rounded-xl border border-gray-100 p-4 flex-row items-start gap-3"
              onPress={() => router.push(`/(app)/recipes/${item.recipeId}`)}
            >
              <View className="flex-1">
                <Text className="font-semibold text-gray-900" numberOfLines={1}>
                  {item.recipe.title}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  ⏱ {item.recipe.cookTimeMinutes} min
                </Text>
                <View className="flex-row flex-wrap gap-1 mt-2">
                  {item.recipe.tags.slice(0, 3).map((t) => (
                    <View key={t.tag.slug} className="px-1.5 py-0.5 bg-olive-subtle rounded">
                      <Text className="text-[10px] text-olive font-medium capitalize">
                        {t.tag.slug.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => remove(item.recipeId)}
                className="p-1.5 mt-0.5"
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text className="text-red-400 text-lg">♥</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
