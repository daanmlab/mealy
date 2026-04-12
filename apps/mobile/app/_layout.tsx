import '../global.css';
import { Stack, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/auth';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  const inAuthGroup = segments[0] === '(auth)';
  const inAppGroup = segments[0] === '(app)';
  const inOnboarding = segments[0] === 'onboarding';

  if (!loading) {
    if (!user && !inAuthGroup) {
      return <Redirect href="/(auth)/login" />;
    }
    if (user && !user.onboardingDone && !inOnboarding) {
      return <Redirect href="/onboarding" />;
    }
    if (user && user.onboardingDone && (inAuthGroup || inOnboarding || !inAppGroup)) {
      return <Redirect href="/(app)/plan" />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </AuthProvider>
  );
}
