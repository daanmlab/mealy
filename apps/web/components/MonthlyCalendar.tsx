'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { Plan } from '@/lib/api';

interface MonthlyCalendarProps {
  year: number;
  month: number;
  selectedWeekStart: Date;
  monthPlans: Record<string, Plan | null>;
  onWeekSelect: (weekStart: Date, day: Date) => void;
  onMonthChange: (year: number, month: number) => void;
  /** 0 = Sunday, 1 = Monday (default) */
  weekStartsOn?: 0 | 1;
}

function getWeekStart(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = weekStartsOn === 1 ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rowMonday(row: Date[], weekStartsOn: 0 | 1): Date {
  return weekStartsOn === 1 ? row[0]! : row[1]!;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0] as string;
}

const DAY_LABELS_MON = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_LABELS_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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
  const gridStart = getWeekStart(firstOfMonth, weekStartsOn);

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

  const selectedWeekISO = toISODate(selectedWeekStart);
  const selectedRowIndex = rows.findIndex(
    (row) => toISODate(rowMonday(row, weekStartsOn)) === selectedWeekISO,
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
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(28,28,24,0.06)] p-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary font-headline">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-surface-container rounded-full transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-surface-container rounded-full transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-7 mb-2">
        {(weekStartsOn === 1 ? DAY_LABELS_MON : DAY_LABELS_SUN).map((label, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[10px] font-bold text-on-surface-variant uppercase tracking-widest"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="relative">
        {rowHeight > 0 && selectedRowIndex !== -1 && (
          <div
            className="absolute inset-x-0 bg-secondary-container/20 rounded-lg pointer-events-none transition-transform duration-300 ease-in-out"
            style={{
              height: rowHeight,
              top: 0,
              transform: `translateY(${selectedRowIndex * rowHeight}px)`,
            }}
          />
        )}

        {rows.map((row, rowIndex) => {
          const monday = rowMonday(row, weekStartsOn);
          const mondayISO = toISODate(monday);
          const isSelectedRow = rowIndex === selectedRowIndex;

          return (
            <div
              key={mondayISO}
              ref={(el) => {
                rowsRef.current[rowIndex] = el;
              }}
              className="grid grid-cols-7 relative z-10"
            >
              {row.map((day) => {
                const dayISO = toISODate(day);
                const isToday = dayISO === todayISO;
                const plan = monthPlans[mondayISO] ?? null;

                const dayOfWeek = DAY_OF_WEEK_MAP[day.getDay()] ?? '';
                const hasMeal = plan !== null && plan.meals.some((m) => m.day === dayOfWeek);
                const hasGrocery =
                  plan !== null && plan.status === 'confirmed' && day.getDay() === 1;

                return (
                  <div
                    key={dayISO}
                    onClick={() => onWeekSelect(monday, day)}
                    className="flex flex-col items-center justify-center py-2 cursor-pointer"
                  >
                    <span
                      className={`text-sm w-8 h-8 flex items-center justify-center rounded-full font-medium transition-colors ${
                        isToday
                          ? 'bg-primary text-on-primary'
                          : isSelectedRow
                            ? 'text-secondary font-bold'
                            : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex gap-0.5 mt-1 h-2 items-center justify-center">
                      {hasMeal && <span className="w-1 h-1 rounded-full bg-secondary block" />}
                      {hasGrocery && <span className="w-1 h-1 rounded-full bg-tertiary block" />}
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
