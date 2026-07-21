export const serviceRolesFallback = ['Камера', 'Звук', 'Медіа'];
export const defaultResponseOptions = ['Можу бути', 'Не можу бути', 'Під питанням'];

export const dayMs = 24 * 60 * 60 * 1000;
export const monthAheadMs = 30 * dayMs;

export const defaultNotificationOffset = 1440;

export const notificationOffsetOptions = [
  { value: 30, label: 'За 30 хвилин' },
  { value: 60, label: 'За 1 годину' },
  { value: 180, label: 'За 3 години' },
  { value: 720, label: 'За 12 годин' },
  { value: 960, label: 'За 16 годин' },
  { value: 1440, label: 'За 1 день' },
  { value: 2880, label: 'За 2 дні' },
  { value: 10080, label: 'За 1 тиждень' }
];

export const adminStorageKey = 'vidmitka-admin';

// Demo data used only when Supabase isn't configured, so the app is still browsable offline.
export const initialServices = [
  {
    id: 'fri-2026-07-24',
    date: '2026-07-24',
    time: '19:00',
    title: 'Вечірнє служіння',
    note: 'Підготовка команди, звук і трансляція',
    roles: ['Камера', 'Звук', 'Зустрічаючі'],
    isRecurring: true,
    recurringParentId: 'fri-evening'
  },
  {
    id: 'sun-2026-07-26',
    date: '2026-07-26',
    time: '11:00',
    title: 'Основне служіння',
    note: 'Трансляція та молитовна підтримка',
    roles: ['Камера', 'Презентація', 'Медіа'],
    isRecurring: true,
    recurringParentId: 'sun-main'
  }
];
