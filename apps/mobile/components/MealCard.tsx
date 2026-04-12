import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import type { PlanMeal } from '@/lib/api';

interface Props {
  meal: PlanMeal;
  dayLabel: string;
  onSwap: () => void;
  onLock: () => void;
}

export default function MealCard({ meal, dayLabel, onSwap, onLock }: Props) {
  return (
    <View className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
      <View className="flex-row items-start justify-between gap-3">
        <TouchableOpacity
          className="flex-1 min-w-0"
          onPress={() => router.push(`/(app)/recipes/${meal.recipe.id}`)}
          activeOpacity={0.7}
        >
          <Text className="text-xs font-medium text-gray-400 uppercase mb-1">{dayLabel}</Text>
          <Text className="font-semibold text-gray-900 leading-snug" numberOfLines={2}>
            {meal.recipe.title}
          </Text>
          <Text className="text-xs text-gray-400 mt-1">⏱ {meal.recipe.cookTimeMinutes} min</Text>
        </TouchableOpacity>
        <View className="flex-row gap-1 items-center pt-1">
          <TouchableOpacity
            onPress={onLock}
            className={`w-8 h-8 rounded-lg items-center justify-center border ${
              meal.isLocked
                ? 'border-olive bg-olive-subtle'
                : 'border-gray-200'
            }`}
          >
            <Text className="text-sm">{meal.isLocked ? '🔒' : '🔓'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSwap}
            disabled={meal.isLocked}
            className="w-8 h-8 rounded-lg border border-gray-200 items-center justify-center"
            style={{ opacity: meal.isLocked ? 0.4 : 1 }}
          >
            <Text className="text-sm">🔄</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
