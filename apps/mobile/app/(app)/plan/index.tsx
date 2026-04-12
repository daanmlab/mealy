import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { plansApi, groceryApi, type Plan, type PlanMeal, type GroceryItem } from '@/lib/api';
import WeekStrip, { getWeekDates, toISODate } from '@/components/WeekStrip';
import MealCard from '@/components/MealCard';
import SwapPickerModal from '@/components/SwapPickerModal';
import GroceryList from '@/components/GroceryList';
import { useWeekStartDay } from '@/hooks/useWeekStartDay';

type Tab = 'meals' | 'grocery';

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export default function PlanScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('meals');
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [swapMeal, setSwapMeal] = useState<PlanMeal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { weekStartsOn } = useWeekStartDay();

  const weekDates = getWeekDates(weekOffset, weekStartsOn);
  const weekStart = toISODate(weekDates[0]!.date);

  const fetchPlan = useCallback(async () => {
    const p = await plansApi.current(weekStart);
    setPlan(p);
    return p;
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    fetchPlan().finally(() => setLoading(false));
  }, [fetchPlan]);

  async function refresh() {
    setRefreshing(true);
    await fetchPlan();
    setRefreshing(false);
  }

  async function generate() {
    setActionLoading(true);
    try {
      const p = await plansApi.create(weekStart);
      setPlan(p);
    } finally {
      setActionLoading(false);
    }
  }

  async function regenerate() {
    if (!plan) return;
    setActionLoading(true);
    try {
      const p = await plansApi.regenerate(plan.id);
      setPlan(p);
    } finally {
      setActionLoading(false);
    }
  }

  async function confirm() {
    if (!plan) return;
    setActionLoading(true);
    try {
      const p = await plansApi.confirm(plan.id);
      setPlan(p);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLock(meal: PlanMeal) {
    if (!plan) return;
    const updated = await plansApi.lock(plan.id, meal.id);
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            meals: prev.meals.map((m) => (m.id === updated.id ? updated : m)),
          }
        : prev,
    );
  }

  async function handleSwap(recipeId: string) {
    if (!plan || !swapMeal) return;
    setSwapMeal(null);
    const updated = await plansApi.swap(plan.id, swapMeal.id, recipeId);
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            meals: prev.meals.map((m) => (m.id === updated.id ? updated : m)),
          }
        : prev,
    );
  }

  async function showGrocery() {
    if (!plan) return;
    setTab('grocery');
    try {
      let list = await groceryApi.get(plan.id);
      if (!list?.items?.length) {
        list = await groceryApi.generate(plan.id);
      }
      setGroceryItems(list.items ?? []);
    } catch {
      const list = await groceryApi.generate(plan.id);
      setGroceryItems(list.items ?? []);
    }
  }

  async function regenerateGrocery() {
    if (!plan) return;
    setActionLoading(true);
    try {
      const list = await groceryApi.generate(plan.id);
      setGroceryItems(list.items ?? []);
    } finally {
      setActionLoading(false);
    }
  }

  const meals = plan?.meals ?? [];
  const isConfirmed = plan?.status === 'confirmed';

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      <WeekStrip
        weekOffset={weekOffset}
        weekStartsOn={weekStartsOn}
        onPrev={() => setWeekOffset((w) => w - 1)}
        onNext={() => setWeekOffset((w) => w + 1)}
      />

      {/* Tab toggle */}
      {plan && (
        <View className="flex-row mx-4 mt-3 mb-1 bg-gray-100 rounded-xl p-1">
          {(['meals', 'grocery'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => (t === 'grocery' ? showGrocery() : setTab('meals'))}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? 'bg-white' : ''}`}
            >
              <Text className={`text-xs font-medium ${tab === t ? 'text-gray-900' : 'text-gray-400'}`}>
                {t === 'meals' ? '🍽 Meals' : '🛒 Grocery'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5c6b3a" />
        </View>
      ) : !plan ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-gray-400 text-center mb-4">No plan for this week yet.</Text>
          <TouchableOpacity
            onPress={generate}
            disabled={actionLoading}
            className="bg-olive px-6 py-3 rounded-xl"
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Generate plan</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : tab === 'grocery' ? (
        <GroceryList
          planId={plan!.id}
          items={groceryItems}
          onItemsChange={setGroceryItems}
          onRegenerate={regenerateGrocery}
          regenerating={actionLoading}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#5c6b3a" />}
        >
          {weekDates.map(({ day }) => {
            const dayMeals = meals.filter((m) => m.day === day);
            if (dayMeals.length === 0) {
              return (
                <View key={day} className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-3">
                  <Text className="text-xs font-medium text-gray-400 uppercase">{DAY_LABELS[day]}</Text>
                  <Text className="text-sm text-gray-300 mt-1">No meal planned</Text>
                </View>
              );
            }
            return dayMeals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                dayLabel={DAY_LABELS[day] ?? day}
                onSwap={() => setSwapMeal(meal)}
                onLock={() => handleLock(meal)}
              />
            ));
          })}

          {/* Actions */}
          {!isConfirmed && (
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={regenerate}
                disabled={actionLoading}
                className="flex-1 py-3 border border-olive rounded-xl items-center"
              >
                <Text className="text-olive font-medium text-sm">↺ Regenerate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirm}
                disabled={actionLoading}
                className="flex-1 py-3 bg-olive rounded-xl items-center"
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-sm">✓ Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isConfirmed && (
            <View className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3 items-center">
              <Text className="text-green-700 text-sm font-medium">✓ Plan confirmed</Text>
            </View>
          )}
        </ScrollView>
      )}

      <SwapPickerModal
        visible={!!swapMeal}
        plan={plan}
        currentRecipeId={swapMeal?.recipe.id}
        onSelect={handleSwap}
        onClose={() => setSwapMeal(null)}
      />
    </SafeAreaView>
  );
}
