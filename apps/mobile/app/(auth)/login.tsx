import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { ApiError } from '@/lib/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-cream"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          <Text className="text-4xl font-bold text-olive text-center mb-2">mealy</Text>
          <Text className="text-gray-500 text-center mb-10 text-sm">
            Your weekly meal planner
          </Text>

          <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <Text className="text-xl font-semibold text-gray-900 mb-2">Sign in</Text>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
              <TextInput
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white"
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
              <TextInput
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? (
              <Text className="text-red-500 text-sm">{error}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className="bg-olive rounded-xl py-3.5 items-center mt-2"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-sm">Sign in</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-center text-sm text-gray-500 mt-6">
            {"Don't have an account? "}
            <Link href="/(auth)/register">
              <Text className="text-olive font-semibold">Sign up</Text>
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
