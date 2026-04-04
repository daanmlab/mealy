'use client';

import { useEffect, useState } from 'react';

/** 0 = Sunday, 1 = Monday */
export type WeekStartDay = 0 | 1;

const STORAGE_KEY = 'weekStartsOn';

export function useWeekStartDay() {
  const [weekStartsOn, setWeekStartsOnState] = useState<WeekStartDay>(1);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '0') setWeekStartsOnState(0);
  }, []);

  function setWeekStartsOn(day: WeekStartDay) {
    setWeekStartsOnState(day);
    localStorage.setItem(STORAGE_KEY, String(day));
  }

  return { weekStartsOn, setWeekStartsOn };
}
