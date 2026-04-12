import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth';
import { usersApi } from '@/lib/api';
import { DISLIKES_OPTIONS, GOALS, COOK_TIMES } from '@/lib/constants';
import { useWeekStartDay } from '@/hooks/useWeekStartDay';
import type { FoodGoal, CookTimePreference } from '@mealy/types';

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { weekStartsOn, setWeekStartsOn } = useWeekStartDay();
  const [name, setName] = useState(user?.name ?? '');
  const [peopleCount, setPeopleCount] = useState(user?.peopleCount ?? 2);
  const [mealsPerWeek, setMealsPerWeek] = useState(user?.mealsPerWeek ?? 5);
  const [cookTime, setCookTime] = useState<CookTimePreference>(user?.cookTime ?? 'under40');
  const [goal, setGoal] = useState<FoodGoal>(user?.goal ?? 'healthy');
  const [dislikes, setDislikes] = useState<string[]>(user?.dislikes ?? []);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  function toggleDislike(item: string) {
    setDislikes((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item],
    );
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await usersApi.updateProfile({ name });
      await refreshUser();
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrefs() {
    setSavingPrefs(true);
    try {
      await usersApi.updatePreferences({ peopleCount, mealsPerWeek, cookTime, goal, dislikes });
      await refreshUser();
    } finally {
      setSavingPrefs(false);
    }
  }

  async function changePassword() {
    if (!newPw || !currentPw) return;
    setSavingPw(true);
    try {
      await usersApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setCurrentPw('');
      setNewPw('');
      Alert.alert('Password updated');
    } catch {
      Alert.alert('Error', 'Could not update password. Check your current password.');
    } finally {
      setSavingPw(false);
    }
  }

  async function deleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await usersApi.deleteAccount();
            await logout();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Profile */}
        <View className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <Text className="font-semibold text-gray-900 mb-3">Profile</Text>
          <Text className="text-xs text-gray-400 mb-1">Name</Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 mb-3"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />
          <Text className="text-xs text-gray-400 mb-1">Email</Text>
          <Text className="text-sm text-gray-500 py-2">{user?.email}</Text>
          <TouchableOpacity
            onPress={saveProfile}
            disabled={savingProfile}
            className="mt-2 bg-olive py-2.5 rounded-lg items-center"
          >
            {savingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-medium text-sm">Save profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <Text className="font-semibold text-gray-900 mb-3">Meal preferences</Text>

          <Text className="text-xs text-gray-400 mb-2">People cooking for</Text>
          <View className="flex-row gap-2 mb-4">
            {[1, 2, 3, 4].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setPeopleCount(n)}
                className={`flex-1 py-2.5 rounded-lg border-2 items-center ${
                  peopleCount === n ? 'border-olive bg-olive-subtle' : 'border-gray-200'
                }`}
              >
                <Text className={`text-sm font-medium ${peopleCount === n ? 'text-olive' : 'text-gray-600'}`}>
                  {n === 4 ? '4+' : n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs text-gray-400 mb-2">Meals per week</Text>
          <View className="flex-row gap-2 mb-4">
            {[3, 4, 5, 7].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setMealsPerWeek(n)}
                className={`flex-1 py-2.5 rounded-lg border-2 items-center ${
                  mealsPerWeek === n ? 'border-olive bg-olive-subtle' : 'border-gray-200'
                }`}
              >
                <Text className={`text-sm font-medium ${mealsPerWeek === n ? 'text-olive' : 'text-gray-600'}`}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs text-gray-400 mb-2">Goal</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {GOALS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                onPress={() => setGoal(value)}
                className={`px-3 py-2 rounded-lg border-2 ${
                  goal === value ? 'border-olive bg-olive-subtle' : 'border-gray-200'
                }`}
              >
                <Text className={`text-xs font-medium ${goal === value ? 'text-olive' : 'text-gray-600'}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs text-gray-400 mb-2">Cook time</Text>
          <View className="flex-row gap-2 mb-4">
            {COOK_TIMES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                onPress={() => setCookTime(value)}
                className={`flex-1 py-2.5 rounded-lg border-2 items-center ${
                  cookTime === value ? 'border-olive bg-olive-subtle' : 'border-gray-200'
                }`}
              >
                <Text className={`text-xs font-medium ${cookTime === value ? 'text-olive' : 'text-gray-600'}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs text-gray-400 mb-2">Week starts on</Text>
          <View className="flex-row gap-2 mb-4">
            {([{ label: 'Monday', value: 1 }, { label: 'Sunday', value: 0 }] as const).map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                onPress={() => setWeekStartsOn(value)}
                className={`flex-1 py-2.5 rounded-lg border-2 items-center ${
                  weekStartsOn === value ? 'border-olive bg-olive-subtle' : 'border-gray-200'
                }`}
              >
                <Text className={`text-sm font-medium ${weekStartsOn === value ? 'text-olive' : 'text-gray-600'}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs text-gray-400 mb-2">Ingredients to avoid</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {DISLIKES_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => toggleDislike(item)}
                className={`px-3 py-1.5 rounded-full border ${
                  dislikes.includes(item) ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              >
                <Text className={`text-xs capitalize ${dislikes.includes(item) ? 'text-red-700' : 'text-gray-600'}`}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={savePrefs}
            disabled={savingPrefs}
            className="bg-olive py-2.5 rounded-lg items-center"
          >
            {savingPrefs ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-medium text-sm">Save preferences</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Password */}
        <View className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <Text className="font-semibold text-gray-900 mb-3">Change password</Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 mb-2"
            placeholder="Current password"
            secureTextEntry
            value={currentPw}
            onChangeText={setCurrentPw}
          />
          <TextInput
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 mb-3"
            placeholder="New password"
            secureTextEntry
            value={newPw}
            onChangeText={setNewPw}
          />
          <TouchableOpacity
            onPress={changePassword}
            disabled={savingPw || !currentPw || !newPw}
            className="bg-olive py-2.5 rounded-lg items-center"
            style={{ opacity: savingPw || !currentPw || !newPw ? 0.5 : 1 }}
          >
            {savingPw ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-medium text-sm">Update password</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View className="gap-3">
          <TouchableOpacity
            onPress={logout}
            className="bg-white border border-gray-200 py-3 rounded-xl items-center"
          >
            <Text className="text-gray-700 font-medium text-sm">Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={deleteAccount}
            className="py-3 rounded-xl items-center"
          >
            <Text className="text-red-500 text-sm">Delete account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
