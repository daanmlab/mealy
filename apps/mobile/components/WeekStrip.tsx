import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

interface WeekStripProps {
  weekOffset: number;
  weekStartsOn?: 0 | 1;
  onPrev: () => void;
  onNext: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getWeekStart(offset = 0, startDay: 0 | 1 = 1): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = startDay === 1
    ? (day === 0 ? -6 : 1 - day)
    : -day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff + offset * 7);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function weekLabel(offset: number): string {
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  if (offset > 1) return `In ${offset} weeks`;
  return `${Math.abs(offset)} weeks ago`;
}

export function getWeekDates(offset: number, startDay: 0 | 1 = 1): { day: string; date: Date }[] {
  const start = getWeekStart(offset, startDay);
  // Build 7-day array starting from startDay
  const days = startDay === 0
    ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    : DAY_NAMES;
  const labels = startDay === 0
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : DAY_LABELS;
  return days.map((day, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { day, date: d, label: labels[i]! };
  });
}

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export default function WeekStrip({ weekOffset, weekStartsOn = 1, onPrev, onNext }: WeekStripProps) {
  const start = getWeekStart(weekOffset, weekStartsOn);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const labels = weekStartsOn === 0
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : DAY_LABELS;

  return (
    <View className="bg-white border-b border-gray-100 px-4 py-3">
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={onPrev} className="p-2 -ml-2">
          <Text className="text-gray-400 text-lg">‹</Text>
        </TouchableOpacity>
        <Text className="text-sm font-semibold text-gray-700">{weekLabel(weekOffset)}</Text>
        <TouchableOpacity onPress={onNext} className="p-2 -mr-2">
          <Text className="text-gray-400 text-lg">›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {labels.map((label, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const isToday = d.getTime() === today.getTime();
            return (
              <View key={label} className="items-center w-9">
                <Text className="text-[10px] text-gray-400 font-medium mb-1">{label}</Text>
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    isToday ? 'bg-olive' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${isToday ? 'text-white' : 'text-gray-600'}`}
                  >
                    {d.getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
