'use client';

import { useEffect, useRef, useState } from 'react';

import type { Plan } from '@/lib/api';

interface MonthlyCalendarProps {
  year: number;
  month: number;
  selectedWeekStart: Date;
  monthPlans: Record<string, Plan | null>;
  onWeekSelect: (weekStart: Date) => void;
  onMonthChange: (year: number, month: number) => void;
  /** 0 = Sunday, 1 = Monday (default) */
  weekStartsOn?: 0 | 1;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns the start of the week containing `date`. */
function getGridWeekStart(date: Date, weekStartsOn: 0 | 1): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0] as string;
}

const DAY_LABELS_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
  weekStartsOn = 1,
}: MonthlyCalendarProps) {
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [rowHeight, setRowHeight] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISODate(today);

  const firstOfMonth = new Date(year, month, 1);
  const gridStart = getGridWeekStart(firstOfMonth, weekStartsOn);

  const rows: Date[][] = [];
  const cursor = new Date(gridStart);

  while (true) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(row);
    if (cursor > new Date(year, month + 1, 0)) break;
  }

  const selectedWeekISO = toISODate(getMonday(selectedWeekStart));
  const selectedRowIndex = rows.findIndex(
    (row) => toISODate(getMonday(row[0]!)) === selectedWeekISO,
  );

  useEffect(() => {
    const el = rowsRef.current[0];
    if (el) setRowHeight(el.offsetHeight);
  }, [rows.length]);

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
      {/* Dark overlay — below sliding pill (z-[2]) and row content (z-[3]) */}
      <div className="absolute inset-0 bg-black/25 z-[1] pointer-events-none rounded-2xl" />

      {/* Header */}
      <div className="relative z-[10] flex items-center justify-between px-3 pt-3 pb-2">
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
      <div className="relative z-[10] grid grid-cols-7 px-1 pb-1">
        {(weekStartsOn === 1 ? DAY_LABELS_MON : DAY_LABELS_SUN).map((label, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[10px] font-medium text-gray-400"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="pb-1 relative">
        {rowHeight > 0 && selectedRowIndex !== -1 && (
          <div
            className="absolute inset-x-1 z-[2] bg-white rounded-[1em] ring-1 ring-green-300 shadow-sm pointer-events-none transition-transform duration-300 ease-in-out"
            style={{
              height: rowHeight,
              top: 0,
              transform: `translateY(${selectedRowIndex * rowHeight}px)`,
            }}
          />
        )}

        {rows.map((row, rowIndex) => {
          const rowMondayISO = toISODate(getMonday(row[0]!));

          return (
            <div
              key={rowMondayISO}
              ref={(el) => {
                rowsRef.current[rowIndex] = el;
              }}
              className="relative z-[3] grid grid-cols-7"
            >
              {row.map((day) => {
                const dayISO = toISODate(day);
                const isToday = dayISO === todayISO;
                const weekMonday = getMonday(day);
                const weekMondayISO = toISODate(weekMonday);
                const plan = monthPlans[weekMondayISO] ?? null;

                const dayOfWeek = DAY_OF_WEEK_MAP[day.getDay()] ?? '';
                const hasMeal = plan !== null && plan.meals.some((m) => m.day === dayOfWeek);
                const hasGrocery = plan !== null && plan.status === 'confirmed' && day.getDay() === 1;

                return (
                  <div
                    key={dayISO}
                    onClick={() => onWeekSelect(weekMonday)}
                    className="flex flex-col items-center justify-start pt-1 pb-1 cursor-pointer"
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
