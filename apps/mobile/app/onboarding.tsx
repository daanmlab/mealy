import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/auth';
import { usersApi } from '@/lib/api';
import { DISLIKES_OPTIONS, GOALS, COOK_TIMES } from '@/lib/constants';
import type { FoodGoal, CookTimePreference } from '@mealy/types';

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [peopleCount, setPeopleCount] = useState(user?.peopleCount ?? 2);
  const [mealsPerWeek, setMealsPerWeek] = useState(user?.mealsPerWeek ?? 5);
  const [cookTime, setCookTime] = useState<CookTimePreference>(user?.cookTime ?? 'under40');
  const [goal, setGoal] = useState<FoodGoal>(user?.goal ?? 'healthy');
  const [dislikes, setDislikes] = useState<string[]>(user?.dislikes ?? []);
  const [saving, setSaving] = useState(false);

  function toggleDislike(item: string) {
    setDislikes((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item],
    );
  }

  async function finish() {
    setSaving(true);
    try {
      await usersApi.updatePreferences({
        peopleCount,
        mealsPerWeek,
        cookTime,
        goal,
        dislikes,
        onboardingDone: true,
      });
      await refreshUser();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-cream"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-1 px-6 pt-16 pb-10">
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-xs text-gray-400 font-medium">
              Step {step + 1} of {TOTAL_STEPS}
            </Text>
            <Text className="text-olive font-bold text-base">mealy</Text>
          </View>
          <View className="h-1.5 bg-gray-100 rounded-full">
            <View
              className="h-full bg-olive rounded-full"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </View>
        </View>

        {/* Step 0 — household */}
        {step === 0 && (
          <View className="space-y-6">
            <Text className="text-xl font-semibold text-gray-900">
              How many people are you cooking for?
            </Text>
            <View className="flex-row gap-3">
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setPeopleCount(n)}
                  className={`flex-1 py-4 rounded-xl border-2 items-center ${
                    peopleCount === n
                      ? 'border-olive bg-olive-subtle'
                      : 'border-gray-200'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      peopleCount === n ? 'text-olive' : 'text-gray-600'
                    }`}
                  >
                    {n === 4 ? '4+' : n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xl font-semibold text-gray-900 mt-4">
              How many dinners per week?
            </Text>
            <View className="flex-row gap-3">
              {[3, 4, 5, 7].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setMealsPerWeek(n)}
                  className={`flex-1 py-4 rounded-xl border-2 items-center ${
                    mealsPerWeek === n
                      ? 'border-olive bg-olive-subtle'
                      : 'border-gray-200'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      mealsPerWeek === n ? 'text-olive' : 'text-gray-600'
                    }`}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 1 — goal + cook time */}
        {step === 1 && (
          <View className="space-y-6">
            <Text className="text-xl font-semibold text-gray-900">
              {"What's your meal goal?"}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {GOALS.map(({ value, label, desc }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setGoal(value)}
                  className={`w-[47%] p-4 rounded-xl border-2 ${
                    goal === value ? 'border-olive bg-olive-subtle' : 'border-gray-200'
                  }`}
                >
                  <Text className="font-semibold text-sm text-gray-900">{label}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">{desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xl font-semibold text-gray-900 mt-4">
              How much time do you have?
            </Text>
            <View className="flex-row gap-3">
              {COOK_TIMES.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setCookTime(value)}
                  className={`flex-1 py-4 rounded-xl border-2 items-center ${
                    cookTime === value
                      ? 'border-olive bg-olive-subtle'
                      : 'border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      cookTime === value ? 'text-olive' : 'text-gray-600'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2 — dislikes */}
        {step === 2 && (
          <View className="space-y-4">
            <View>
              <Text className="text-xl font-semibold text-gray-900">
                Any ingredients to avoid?
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                Optional — you can skip this
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {DISLIKES_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => toggleDislike(item)}
                  className={`px-4 py-2 rounded-full border-2 ${
                    dislikes.includes(item)
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium capitalize ${
                      dislikes.includes(item) ? 'text-red-700' : 'text-gray-600'
                    }`}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View className="flex-1" />

        {/* Navigation buttons */}
        <View className="flex-row gap-3 mt-8">
          {step > 0 && (
            <TouchableOpacity
              onPress={() => setStep((s) => s - 1)}
              className="flex-1 py-3.5 border border-gray-200 rounded-xl items-center"
            >
              <Text className="text-sm font-medium text-gray-600">Back</Text>
            </TouchableOpacity>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <TouchableOpacity
              onPress={() => setStep((s) => s + 1)}
              className="flex-1 py-3.5 bg-olive rounded-xl items-center"
            >
              <Text className="text-white font-semibold text-sm">Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={finish}
              disabled={saving}
              className="flex-1 py-3.5 bg-olive rounded-xl items-center"
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-sm">{"Let's go →"}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
