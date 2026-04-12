import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WeekStartDay = 0 | 1;

const STORAGE_KEY = 'weekStartsOn';

export function useWeekStartDay() {
  const [weekStartsOn, setWeekStartsOnState] = useState<WeekStartDay>(1);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === '0') setWeekStartsOnState(0);
    });
  }, []);

  async function setWeekStartsOn(day: WeekStartDay) {
    setWeekStartsOnState(day);
    await AsyncStorage.setItem(STORAGE_KEY, String(day));
  }

  return { weekStartsOn, setWeekStartsOn };
}
