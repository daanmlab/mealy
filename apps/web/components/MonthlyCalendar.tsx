'use client';

import type { Plan } from '@/lib/api';

interface MonthlyCalendarProps {
  year: number;
  month: number; // 0-indexed (Jan=0, Dec=11)
  selectedWeekStart: Date; // Monday of the currently selected week
  monthPlans: Record<string, Plan | null>; // keyed by ISO date string of week's Monday
  onWeekSelect: (weekStart: Date) => void;
  onMonthChange: (year: number, month: number) => void;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0] as string;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const DAY_OF_WEEK_MAP: Record<number, string> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  0: 'sunday',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function MonthlyCalendar({
  year,
  month,
  selectedWeekStart,
  monthPlans,
  onWeekSelect,
  onMonthChange,
}: MonthlyCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISODate(today);

  const firstOfMonth = new Date(year, month, 1);
  const gridStart = getMonday(firstOfMonth);

  // Build rows of 7 days each; stop once we've covered all days in the current month
  const rows: Date[][] = [];
  const cursor = new Date(gridStart);

  while (true) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(row);
    // Stop when the next week starts and we've already passed the last day of the month
    const lastDayOfMonth = new Date(year, month + 1, 0);
    if (cursor > lastDayOfMonth) break;
  }

  const selectedWeekISO = toISODate(getMonday(selectedWeekStart));

  function handlePrevMonth() {
    if (month === 0) {
      onMonthChange(year - 1, 11);
    } else {
      onMonthChange(year, month - 1);
    }
  }

  function handleNextMonth() {
    if (month === 11) {
      onMonthChange(year + 1, 0);
    } else {
      onMonthChange(year, month + 1);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white select-none">
      {/* Dark overlay — sits above non-selected rows (z-0), below selected row (z-2) */}
      <div className="absolute inset-0 bg-black/25 z-1 pointer-events-none rounded-2xl" />

      {/* Header */}
      <div className="relative z-2 flex items-center justify-between px-3 pt-3 pb-2">
        <button
          onClick={handlePrevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 text-sm font-medium"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={handleNextMonth}
          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 text-sm font-medium"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Column headers */}
      <div className="relative z-2 grid grid-cols-7 px-1 pb-1">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[10px] font-medium text-gray-400"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="pb-1">
        {rows.map((row) => {
          const rowMondayISO = toISODate(row[0]!);
          const isSelectedWeek = rowMondayISO === selectedWeekISO;

          return (
            <div
              key={rowMondayISO}
              className={
                isSelectedWeek
                  ? 'relative z-2 grid grid-cols-7 bg-white rounded-[1em] ring-1 ring-green-300 shadow-sm mx-1'
                  : 'relative z-0 grid grid-cols-7'
              }
            >
              {row.map((day) => {
                const dayISO = toISODate(day);
                const isToday = dayISO === todayISO;
                const weekMonday = getMonday(day);
                const weekMondayISO = toISODate(weekMonday);
                const plan = monthPlans[weekMondayISO] ?? null;

                const dayOfWeek = DAY_OF_WEEK_MAP[day.getDay()] ?? '';
                const hasMeal =
                  plan !== null &&
                  plan.meals.some((m) => m.day === dayOfWeek);
                const hasGrocery =
                  plan !== null &&
                  plan.status === 'confirmed' &&
                  day.getDay() === 1; // Monday

                return (
                  <div
                    key={dayISO}
                    onClick={() => {
                      onWeekSelect(weekMonday);
                    }}
                    className={`flex flex-col items-center justify-start pt-1 pb-1 cursor-pointer`}
                  >
                    <span
                      className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full font-medium ${
                        isToday
                            ? 'bg-green-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex gap-0.5 mt-0.5 h-2 items-center justify-center">
                      {hasMeal && (
                        <span className="w-1 h-1 rounded-full bg-green-500 block" />
                      )}
                      {hasGrocery && (
                        <span className="w-1 h-1 rounded-full bg-amber-400 block" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
