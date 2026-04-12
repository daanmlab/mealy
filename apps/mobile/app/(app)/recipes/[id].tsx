import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { recipesApi, favoritesApi, type Recipe } from '@/lib/api';

function formatAmount(amount: number): string {
  return amount % 1 === 0 ? String(amount) : amount.toFixed(1);
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([recipesApi.get(id), favoritesApi.list()])
      .then(([r, favs]) => {
        setRecipe(r);
        setIsFav(favs.some((f) => f.recipeId === id));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFav() {
    if (!recipe) return;
    if (isFav) {
      await favoritesApi.remove(recipe.id);
      setIsFav(false);
    } else {
      await favoritesApi.add(recipe.id);
      setIsFav(true);
    }
  }

  if (loading || !recipe) {
    return (
      <View className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#5c6b3a" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-start justify-between gap-3">
          <TouchableOpacity onPress={() => router.back()} className="pt-0.5">
            <Text className="text-2xl text-gray-400">‹</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900 leading-snug">{recipe.title}</Text>
          </View>
          <TouchableOpacity onPress={toggleFav} className="pt-0.5">
            <Text className="text-2xl">{isFav ? '♥' : '♡'}</Text>
          </TouchableOpacity>
        </View>

        {/* Meta */}
        <View className="flex-row gap-4 px-4 mb-4">
          <Text className="text-sm text-gray-500">⏱ {recipe.cookTimeMinutes} min</Text>
          <Text className="text-sm text-gray-500">👤 {recipe.servings} servings</Text>
        </View>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-2 px-4 mb-4">
            {recipe.tags.map((t) => (
              <View key={t.tag.slug} className="px-2 py-1 bg-olive-subtle rounded-full">
                <Text className="text-xs text-olive font-medium capitalize">
                  {t.tag.slug.replace(/_/g, ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        {recipe.description && (
          <View className="mx-4 mb-4 bg-white rounded-xl p-4 border border-gray-100">
            <Text className="text-sm text-gray-600 leading-relaxed">{recipe.description}</Text>
          </View>
        )}

        {/* Ingredients */}
        <View className="mx-4 mb-4 bg-white rounded-xl p-4 border border-gray-100">
          <Text className="font-semibold text-gray-900 mb-3">Ingredients</Text>
          {recipe.ingredients.map((ing) => (
            <View key={ing.id} className="flex-row justify-between py-1.5 border-b border-gray-50">
              <Text className="text-sm text-gray-700 flex-1">{ing.ingredient.name}</Text>
              <Text className="text-sm text-gray-400">
                  {formatAmount(ing.amount)} {ing.unit?.symbol ?? ''}
                </Text>
            </View>
          ))}
        </View>

        {/* Steps */}
        <View className="mx-4 mb-4">
          <Text className="font-semibold text-gray-900 mb-3">Instructions</Text>
          {recipe.steps.sort((a, b) => a.order - b.order).map((step, i) => (
            <View key={i} className="flex-row gap-3 mb-4">
              <View className="w-6 h-6 rounded-full bg-olive items-center justify-center mt-0.5 shrink-0">
                <Text className="text-white text-xs font-bold">{step.order}</Text>
              </View>
              <Text className="text-sm text-gray-700 leading-relaxed flex-1">{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
