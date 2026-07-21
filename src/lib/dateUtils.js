import { dayMs } from './constants';

export const getTodayInputDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

export const formatDateInput = (date) => {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const getServiceStart = (service) => new Date(`${service.date}T${service.time}`);

export const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const formatServiceDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(value);
};

export const sortServices = (items) =>
  [...items].sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`));

export const startOfWeek = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
};

const weekRangeFormatter = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' });

export const formatWeekRangeLabel = (weekStart) => {
  const weekEnd = addDays(weekStart, 6);
  return `${weekRangeFormatter.format(weekStart)} – ${weekRangeFormatter.format(weekEnd)}`;
};

// Buckets services into "Цей тиждень" / "Наступний тиждень" / dated week ranges,
// so a month of (mostly recurring) services doesn't render as one long flat list.
export const groupServicesByWeek = (items, now = new Date()) => {
  const currentWeekStart = startOfWeek(now);
  const groups = [];
  const indexByOffset = new Map();

  sortServices(items).forEach((service) => {
    const serviceWeekStart = startOfWeek(getServiceStart(service));
    const weekOffset = Math.round((serviceWeekStart.getTime() - currentWeekStart.getTime()) / (7 * dayMs));

    if (!indexByOffset.has(weekOffset)) {
      const label = weekOffset <= 0
        ? 'Цей тиждень'
        : weekOffset === 1
          ? 'Наступний тиждень'
          : formatWeekRangeLabel(serviceWeekStart);

      indexByOffset.set(weekOffset, groups.length);
      groups.push({ key: weekOffset, label, services: [] });
    }

    groups[indexByOffset.get(weekOffset)].services.push(service);
  });

  return groups;
};
